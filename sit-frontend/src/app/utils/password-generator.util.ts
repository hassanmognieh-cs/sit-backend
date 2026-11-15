/**
 * Password Generator Utility
 * Generates strong temporary passwords meeting security requirements
 */
export class PasswordGenerator {
  private static readonly UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private static readonly LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  private static readonly NUMBERS = '0123456789';
  private static readonly SPECIAL = '@#$%&*!';

  /**
   * Generates a strong temporary password
   * Format: [Prefix][Special][Suffix][Special][Number][Number][Number][Number]
   * Example: Emp@SIT#4821, Mgr@Inv#9204, Adm@Sys#7712
   */
  static generateTemporaryPassword(role: string = 'employee'): string {
    // Generate prefix based on role (first 3 chars, uppercase)
    const rolePrefix = role.substring(0, 3).toUpperCase().padEnd(3, 'X');
    
    // Generate first random special character
    const special1 = this.SPECIAL[Math.floor(Math.random() * this.SPECIAL.length)];
    
    // Generate random suffix (3 uppercase letters)
    const suffix = Array.from({ length: 3 }, () => 
      this.UPPERCASE[Math.floor(Math.random() * this.UPPERCASE.length)]
    ).join('');
    
    // Generate second random special character
    const special2 = this.SPECIAL[Math.floor(Math.random() * this.SPECIAL.length)];
    
    // Generate random 4-digit number
    const numbers = Array.from({ length: 4 }, () => 
      this.NUMBERS[Math.floor(Math.random() * this.NUMBERS.length)]
    ).join('');
    
    // Combine: Prefix + Special1 + Suffix + Special2 + Numbers
    // Example: Emp@SIT#4821, Mgr@Inv#9204
    return `${rolePrefix}${special1}${suffix}${special2}${numbers}`;
  }

  /**
   * Validates if a password meets strong password requirements
   */
  static validateStrongPassword(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[@#$%&*!]/.test(password)) {
      errors.push('Password must contain at least one special character (@, #, $, %, &, *, !)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

