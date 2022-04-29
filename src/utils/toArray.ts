export const toArray = <TInput>(input: TInput | TInput[]): TInput[] =>
  Array.isArray(input) && typeof input !== 'string' ? input : [input];
