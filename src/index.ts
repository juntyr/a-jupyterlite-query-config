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

    for (const [query, path] of Object.entries(overrides)) {
      const value = searchParams.get(query);
      if (value === null) {
        continue;
      }

      const [key, ...keys] = path.split('.');

      if (keys.length === 0) {
        PageConfig.setOption(key, value);
        continue;
      }

      const option = JSON.parse(PageConfig.getOption(key));
      let curr = option;

      for (const [i, k] of keys.entries()) {
        if (i < keys.length - 1) {
          if (curr[k] === undefined) {
            curr[k] = {};
          }
          curr = curr[k];
        } else {
          curr[k] = JSON.parse(value);
        }
      }

      PageConfig.setOption(key, JSON.stringify(option));
    }
  }
};

export default plugin;
