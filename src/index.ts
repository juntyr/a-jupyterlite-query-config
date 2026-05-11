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

    type TSON =
      | null
      | string
      | number
      | boolean
      | { [key: string]: TSON }
      | TSON[];

    function mergeJson(prev: undefined | TSON, patch: TSON): TSON {
      if (
        patch === null ||
        typeof patch === 'string' ||
        typeof patch === 'number' ||
        typeof patch === 'boolean'
      ) {
        return patch;
      }

      if (Array.isArray(patch)) {
        return patch.map((e, i) =>
          mergeJson(Array.isArray(prev) ? prev[i] : undefined, e)
        );
      }

      const concat = '$conat' as keyof typeof patch;
      if (Object.prototype.hasOwnProperty.call(patch, concat)) {
        if (Object.keys(patch).length !== 1) {
          throw new SyntaxError(`${concat} must be the only key`);
        }
        patch = patch[concat];
        if (!Array.isArray(prev) || !Array.isArray(patch)) {
          throw new TypeError(`can only ${concat} two arrays`);
        }
        return [...prev, ...[patch.map(e => mergeJson(undefined, e))]];
      }

      const override_ = '$override' as keyof typeof patch;
      if (Object.prototype.hasOwnProperty.call(patch, override_)) {
        if (Object.keys(patch).length !== 1) {
          throw new SyntaxError(`${override_} must be the only key`);
        }
        patch = patch[override_];
        if (
          prev === null ||
          typeof prev !== 'object' ||
          Array.isArray(prev) ||
          patch === null ||
          typeof patch !== 'object' ||
          Array.isArray(patch)
        ) {
          throw new TypeError(
            `can only ${override_} one object with another object`
          );
        }
        return {
          ...prev,
          ...Object.entries(patch).reduce(
            (obj: { [key: string]: TSON }, [k, e]) => {
              obj[k] = mergeJson(undefined, e);
              return obj;
            },
            {}
          )
        };
      }

      return Object.entries(patch).reduce(
        (obj: { [key: string]: TSON }, [k, e]) => {
          if (k.startsWith('$')) {
            throw new SyntaxError(`unknown merge operator '${k}'`);
          }
          obj[k] = mergeJson(
            prev === null || typeof prev !== 'object' || Array.isArray(prev)
              ? undefined
              : prev[k],
            e
          );
          return obj;
        },
        {}
      );
    }

    for (const [query, path] of Object.entries(overrides)) {
      const value_ = searchParams.get(query);
      if (value_ === null) {
        continue;
      }
      const value = JSON.parse(value_);

      const [key, ...keys] = path.split('.');

      const option_ = PageConfig.getOption(key);
      const option = option_ === '' ? {} : JSON.parse(option_);

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
