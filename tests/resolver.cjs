/**
 * Custom Jest resolver to map .js imports to .ts files
 * This is needed because ES modules require .js extensions in imports,
 * but the actual source files are .ts
 */
const { resolve } = require('path');
const { existsSync } = require('fs');

module.exports = function resolver(path, options) {
  // First try the default resolver
  try {
    return options.defaultResolver(path, options);
  } catch (e) {
    // If the path ends with .js, try to find the .ts file
    if (path.endsWith('.js')) {
      const tsPath = path.replace(/\.js$/, '.ts');
      
      // Try direct .ts file
      let absolutePath = resolve(options.basedir, tsPath);
      if (existsSync(absolutePath)) {
        return absolutePath;
      }
      
      // For relative imports, also check if removing /index helps
      // (e.g., '../shared/config/index.ts' -> '../shared/config.ts')
      if (tsPath.endsWith('/index.ts')) {
        const noIndexPath = tsPath.replace(/\/index\.ts$/, '.ts');
        absolutePath = resolve(options.basedir, noIndexPath);
        if (existsSync(absolutePath)) {
          return absolutePath;
        }
      }
    }
    
    // If still not found, throw the original error
    throw e;
  }
};
