export default function mockDateHelper(targetDate: Date | string | number) {
  const currentDate =
    targetDate instanceof Date ? targetDate : new Date(targetDate);
  const RealDate = Date;
  // @ts-expect-error
  global.Date = class extends Date {
    constructor(...args: unknown[]) {
      // @ts-expect-error
      super(...args);
      if (args.length === 0) return currentDate;

      // @ts-expect-error
      return new RealDate(...args);
    }

    static now = () => currentDate.getTime();
  };

  const cleanup = () => {
    global.Date = RealDate;
  };

  return cleanup;
}
