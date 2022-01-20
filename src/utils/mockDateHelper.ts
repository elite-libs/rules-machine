
export default function mockDateHelper(targetDate: Date | string | number) {
  const currentDate = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const realDate = Date;
  // @ts-ignore
  global.Date = class extends Date {
    constructor(...args: unknown[]) {
      // @ts-ignore
      super(...args);
      if (args.length === 0) {
        return currentDate;
      }
      // @ts-ignore
      return new realDate(...args);
    }
    static now = () => currentDate.getTime();
  };

  const cleanup = () => {
    // @ts-ignore
    global.Date = realDate;
  }

  return cleanup;
}