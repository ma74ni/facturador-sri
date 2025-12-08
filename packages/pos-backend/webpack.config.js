module.exports = function (options, webpack) {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      alias: {
        ...options.resolve.alias,
        '@prisma/client': require.resolve('./node_modules/.prisma/client-pos'),
      },
    },
  };
};
