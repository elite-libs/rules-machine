export class UserError extends Error {
  name = 'UserError';
  constructor(message: string, debugMode = true) {
    super(message);
    // this.stack = debugMode ? this.stack : '';
  }

  get stack() {
    return '';
  }

  toString() {
    return this.message;
  }
}
