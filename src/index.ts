import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { PageConfig } from '@jupyterlab/coreutils';

/**
 * The id for the extension, and key in the litePlugins.
 */
const PLUGIN_ID = 'a-jupyterlite-query-config:plugin';

/**
 * Initialization data for the a-jupyterlite-query-config extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  autoStart: true,
  requires: [],
  activate: (_app: JupyterFrontEnd) => {
    console.log(
      'JupyterLite extension a-jupyterlite-query-config is activated!'
    );

    const config =
      JSON.parse(PageConfig.getOption('litePluginSettings') || '{}')[
        PLUGIN_ID
      ] || {};
    const overrides: Record<string, string> = config.overrides || {};

    const searchParams = new URL(window.location.href).searchParams;

    function mergeJson(prev, patch) {
      let patchType = Array.isArray(patch) ? 'array' : typeof patch;

      if (
        patch === null ||
        ['string', 'number', 'boolean'].includes(patchType)
      ) {
        return patch;
      }

      const prevType = Array.isArray(prev) ? 'array' : typeof prev;

      if (patchType === 'array') {
        return patch.map((e, i) => mergeJson(prev[i], e));
      }

      const patchKeys = Object.keys(patch);

      if (patchKeys.includes('$concat')) {
        if (patchKeys.length !== 1) {
          throw new SyntaxError('$concat must be the only key');
        }
        patch = patch['$concat'];
        patchType = Array.isArray(patch) ? 'array' : typeof patch;
        if (prevType !== 'array' || patchType !== 'array') {
          throw new TypeError('can only $concat two arrays');
        }
        return [...prev, ...[patch.map(e => mergeJson(undefined, e))]];
      }

      if (patchKeys.includes('$override')) {
        if (patchKeys.length !== 1) {
          throw new SyntaxError('$override must be the only key');
        }
        patch = patch['$override'];
        patchType = Array.isArray(patch) ? 'array' : typeof patch;
        if (prevType !== 'object' || patchType !== 'object') {
          throw new TypeError(
            'can only $override one object with another object'
          );
        }
        return {
          ...prev,
          ...Object.entries(patch).reduce((obj, [k, e]) => {
            obj[k] = mergeJson(undefined, e);
            return obj;
          }, {})
        };
      }

      return Object.entries(patch).reduce((obj, [k, e]) => {
        if (k.startsWith('$')) {
          throw new SyntaxError(`unknown merge operator '${k}'`);
        }
        obj[k] = mergeJson(prev[k], e);
        return obj;
      }, {});

      return patch.map((e, i) => mergeJson(prev[i], e));
    }

    for (const [query, path] of Object.entries(overrides)) {
      const value = JSON.parse(searchParams.get(query));
      if (value === null) {
        continue;
      }

      const [key, ...keys] = path.split('.');

      const option = JSON.parse(PageConfig.getOption(key));

      if (keys.length === 0) {
        try {
          PageConfig.setOption(key, JSON.stringify(mergeJson(option, value)));
        } catch (err) {
          console.error(
            `failed to apply JupyterLite query config '${key}'=${value}: ${err}`
          );
        }
        continue;
      }

      let curr = option;

      for (const [i, k] of keys.entries()) {
        if (i < keys.length - 1) {
          if (curr[k] === undefined) {
            curr[k] = {};
          }
          curr = curr[k];
        } else {
          try {
            curr[k] = mergeJson(curr[k], value);
          } catch (err) {
            console.error(
              `failed to apply JupyterLite query config '${key}'=${value}: ${err}`
            );
          }
        }
      }

      PageConfig.setOption(key, JSON.stringify(option));
    }
  }
};

export default plugin;
