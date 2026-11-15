using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Grpc.Auth;
using FirebaseAdmin;
using FirebaseAdmin.Auth;

var builder = WebApplication.CreateBuilder(args);

// ─────────────────────────────────────────────
// Load service account key
// ─────────────────────────────────────────────
var credentialPath = Path.Combine(
    Directory.GetCurrentDirectory(),
    "Configs",
    "serviceAccountKey.json"
);

// لازم هالملف يكون موجود
var credential = GoogleCredential
    .FromFile(credentialPath)
    .CreateScoped("https://www.googleapis.com/auth/cloud-platform");

// Firestore credentials
var channelCredentials = credential.ToChannelCredentials();

// ─────────────────────────────────────────────
// Initialize Firestore DB
// ─────────────────────────────────────────────
FirestoreDb firestoreDb = new FirestoreDbBuilder
{
    ProjectId = "smart-inventory-tracker-65588",
    ChannelCredentials = channelCredentials
}.Build();

builder.Services.AddSingleton(firestoreDb);

// ─────────────────────────────────────────────
// Initialize Firebase Admin SDK (VERY IMPORTANT)
// ─────────────────────────────────────────────
if (FirebaseApp.DefaultInstance == null)
{
    FirebaseApp.Create(new AppOptions
    {
        Credential = GoogleCredential.FromFile(credentialPath)
    });
}

// ─────────────────────────────────────────────
// MVC Controllers
// ─────────────────────────────────────────────
builder.Services.AddControllers();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", p =>
        p.AllowAnyOrigin()
         .AllowAnyHeader()
         .AllowAnyMethod());
});

var app = builder.Build();

// Ensure routing is in place so controller endpoints and CORS preflight work reliably
app.UseRouting();
app.UseCors("AllowAll");
app.UseAuthorization(); // Add authorization middleware
app.MapControllers();
app.Run();
