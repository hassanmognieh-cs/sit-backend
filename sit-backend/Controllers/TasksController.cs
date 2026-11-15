using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using FirebaseAdmin.Auth;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TasksController : ControllerBase
    {
        private readonly FirestoreDb _firestore;

        public TasksController(FirestoreDb firestore)
        {
            _firestore = firestore;
        }

        // Helper method to get authenticated user info
        private async Task<(bool ok, string? uid, string? email, string? role, IActionResult? errorResult)> RequireAuthAsync()
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                return (false, null, null, null, Unauthorized(new { message = "Missing Authorization Bearer token." }));
            }

            var token = authHeader.Substring("Bearer ".Length).Trim();
            if (string.IsNullOrWhiteSpace(token))
            {
                return (false, null, null, null, Unauthorized(new { message = "Missing Authorization Bearer token." }));
            }

            FirebaseToken decoded;
            try
            {
                decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
            }
            catch
            {
                return (false, null, null, null, Unauthorized(new { message = "Invalid or expired token." }));
            }

            var uid = decoded.Uid;
            var email = decoded.Claims.TryGetValue("email", out var emailObj) ? emailObj?.ToString() : null;

            if (string.IsNullOrWhiteSpace(uid))
            {
                return (false, null, null, null, Unauthorized(new { message = "Invalid token (no uid)." }));
            }

            // Get user role from Firestore
            var callerDoc = await _firestore.Collection("users").Document(uid).GetSnapshotAsync().ConfigureAwait(false);
            if (!callerDoc.Exists)
            {
                return (false, uid, email, null, Forbid());
            }

            var role = callerDoc.ContainsField("role") ? (callerDoc.GetValue<string>("role") ?? string.Empty) : string.Empty;
            var status = callerDoc.ContainsField("status") ? (callerDoc.GetValue<string>("status") ?? "active") : "active";

            if (!string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
            {
                return (false, uid, email, role, Forbid());
            }

            return (true, uid, email, role, null);
        }

        // Update task status (for employees and managers)
        [HttpPut("update-status/{taskId}")]
        public async Task<IActionResult> UpdateTaskStatus(string taskId, [FromBody] Dictionary<string, object> request)
        {
            try
            {
                var (ok, uid, email, role, errorResult) = await RequireAuthAsync();
                if (!ok)
                {
                    Console.WriteLine($"[TasksUpdateStatus] Authorization failed for taskId={taskId}");
                    return errorResult!;
                }

                Console.WriteLine($"[TasksUpdateStatus] Caller uid={uid}, email={email}, role={role}, updating task={taskId}");

                if (string.IsNullOrWhiteSpace(taskId))
                    return BadRequest(new { message = "Task ID is required." });

                if (request == null || !request.TryGetValue("status", out var statusObj) || statusObj == null)
                    return BadRequest(new { message = "Status is required." });

                var status = statusObj.ToString()?.Trim() ?? "";
                var statusLower = status.ToLowerInvariant();

                // Validate status
                if (statusLower != "pending" && statusLower != "taken" && statusLower != "done")
                    return BadRequest(new { message = "Status must be 'Pending', 'Taken', or 'Done'." });

                // Normalize status to proper case
                status = statusLower == "done" ? "Done" : (statusLower == "taken" ? "Taken" : "Pending");

                // Get completed status
                bool completed = status == "Done";
                if (request.TryGetValue("completed", out var completedObj))
                {
                    if (completedObj is bool completedBool)
                        completed = completedBool;
                    else if (bool.TryParse(completedObj?.ToString(), out var parsedCompleted))
                        completed = parsedCompleted;
                }

                // Check if task exists - try document ID first, then search by any ID field if needed
                var taskDoc = await _firestore.Collection("tasks").Document(taskId).GetSnapshotAsync().ConfigureAwait(false);
                string actualTaskId = taskId;
                
                if (!taskDoc.Exists)
                {
                    // Log for debugging
                    Console.WriteLine($"[TasksUpdateStatus] Task not found by document ID taskId={taskId}, attempting search...");
                    
                    // Try to find task by searching - this shouldn't normally happen, but helps with debugging
                    var allTasksQuery = _firestore.Collection("tasks").Limit(100);
                    var allTasksSnapshot = await allTasksQuery.GetSnapshotAsync().ConfigureAwait(false);
                    
                    Console.WriteLine($"[TasksUpdateStatus] Total tasks in collection: {allTasksSnapshot.Count}");
                    
                    bool found = false;
                    foreach (var doc in allTasksSnapshot.Documents)
                    {
                        if (doc.Id == taskId)
                        {
                            taskDoc = doc;
                            actualTaskId = doc.Id;
                            found = true;
                            Console.WriteLine($"[TasksUpdateStatus] Found task by iterating, actual ID={actualTaskId}");
                            break;
                        }
                    }
                    
                    if (!found)
                    {
                        Console.WriteLine($"[TasksUpdateStatus] Task not found anywhere. Searched taskId={taskId}");
                        Console.WriteLine($"[TasksUpdateStatus] Available task IDs: {string.Join(", ", allTasksSnapshot.Documents.Select(d => d.Id).Take(5))}");
                        return NotFound(new { message = $"Task not found. Task ID: {taskId}" });
                    }
                }
                else
                {
                    Console.WriteLine($"[TasksUpdateStatus] Task found successfully by document ID taskId={taskId}");
                }

                var taskData = taskDoc.ToDictionary();
                var assignedToEmail = taskData.TryGetValue("assignedToEmail", out var assignedObj) ? assignedObj?.ToString() : "all";

                // Check permissions
                // Managers and admins can update any task
                var roleLower = role?.Trim().ToLowerInvariant() ?? "";
                bool canUpdate = roleLower == "manager" || roleLower == "admin" || roleLower == "superadmin";

                // Employees can only update tasks assigned to them or to 'all'
                if (!canUpdate && roleLower == "employee")
                {
                    if (string.IsNullOrWhiteSpace(email))
                    {
                        Console.WriteLine($"[TasksUpdateStatus] Employee has no email, cannot update task");
                        return Forbid();
                    }

                    if (assignedToEmail != email && assignedToEmail != "all")
                    {
                        Console.WriteLine($"[TasksUpdateStatus] Forbidden: Employee {email} cannot update task assigned to {assignedToEmail}");
                        return StatusCode(403, new { message = "You do not have permission to update this task. This task is not assigned to you." });
                    }

                    canUpdate = true;
                }

                if (!canUpdate)
                {
                    Console.WriteLine($"[TasksUpdateStatus] Forbidden: User role={role} cannot update tasks");
                    return StatusCode(403, new { message = "You do not have permission to update this task. Please contact your manager." });
                }

                // Employees can only update status and completed fields
                // Managers/admins can update any fields
                var updateData = new Dictionary<string, object?>();

                if (roleLower == "employee")
                {
                    // Employees can only update status and completed
                    updateData["status"] = status;
                    updateData["completed"] = completed;
                }
                else
                {
                    // Managers/admins can update any fields, but if only status/completed provided, only update those
                    if (request.ContainsKey("status"))
                        updateData["status"] = status;
                    if (request.ContainsKey("completed"))
                        updateData["completed"] = completed;
                    // Add other fields if provided (for full task updates)
                    if (request.TryGetValue("title", out var titleObj)) updateData["title"] = titleObj;
                    if (request.TryGetValue("description", out var descObj)) updateData["description"] = descObj;
                    if (request.TryGetValue("assignedToEmail", out var assignObj)) updateData["assignedToEmail"] = assignObj;
                    if (request.TryGetValue("dueDate", out var dueDateObj)) updateData["dueDate"] = dueDateObj;
                }

                // Update task in Firestore using the actual document ID
                await _firestore.Collection("tasks").Document(actualTaskId).UpdateAsync(updateData).ConfigureAwait(false);

                Console.WriteLine($"[TasksUpdateStatus] Task updated successfully tasks/{actualTaskId} to status={status}, completed={completed}");

                return Ok(new { message = "Task status updated successfully.", status, completed });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TasksUpdateStatus] Exception updating task taskId={taskId}. Error: {ex.Message}");
                Console.WriteLine($"[TasksUpdateStatus] Stack trace: {ex.StackTrace}");
                return StatusCode(500, new { message = $"Failed to update task: {ex.Message}" });
            }
        }
    }
}

