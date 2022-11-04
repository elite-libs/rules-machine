export class UserError extends Error {
  name = 'UserError';
  constructor(message: string, debugMode = false) {
    super(message);
    this.stack = debugMode ? this.stack : '';
  }
}
