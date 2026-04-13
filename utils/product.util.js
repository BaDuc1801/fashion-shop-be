export const calcStock = (sizeVariants = []) => {
  return sizeVariants.reduce(
    (sum, size) =>
      sum + size.colors.reduce((acc, c) => acc + (c.quantity || 0), 0),
    0
  );
};
