
export const AssignmentOperators: { [key: string]: (a: any, b: any) => any } = {
  '%=': (a: number, b: number) => a % b,
  '||=': (a: any, b: any) => a || b,
  '??=': (a: any, b: any) => a ?? b,
};
