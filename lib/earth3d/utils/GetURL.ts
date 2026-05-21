export async function GetURL(url: string): Promise<ArrayBuffer | null> {
    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 404) {
            // Some octree node paths simply don't exist — this is normal
            return null;
        }
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response.arrayBuffer();
}
