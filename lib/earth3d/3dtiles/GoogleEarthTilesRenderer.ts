import { TilesRenderer } from '3d-tiles-renderer';
import { GoogleEarthTilesetPlugin } from './GoogleEarthTilesetPlugin';

export class GoogleEarthTilesRenderer extends TilesRenderer {
    public googleEarthPlugin: GoogleEarthTilesetPlugin;

    constructor(options?: { urlPrefix?: string; epoch?: number }) {
        // We pass a dummy URL since loadRootTileset will be overridden by the plugin
        super('google-earth://root');

        this.googleEarthPlugin = new GoogleEarthTilesetPlugin(options);
        this.registerPlugin(this.googleEarthPlugin);

        // Recommended settings for globe rendering
        this.errorTarget = 6;
        this.errorThreshold = 60;
        this.maxDepth = 30;
        this.loadSiblings = true;
    }
}
