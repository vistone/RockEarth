const octant_dict: Record<string, [number, number, number]> = {
    '0': [0, 0, 0],
    '1': [1, 0, 0],
    '2': [0, 1, 0],
    '3': [1, 1, 0],
    '4': [0, 0, 1],
    '5': [1, 0, 1],
    '6': [0, 1, 1],
    '7': [1, 1, 1],
}

interface LatLon {
    lat: number,
    lon: number
}

export class LatLonBox {
    public n: number;
    public s: number;
    public w: number;
    public e: number;

    constructor(n: number, s: number, w: number, e: number) {
        this.n = n;
        this.s = s;
        this.w = w;
        this.e = e;
    }

    public mid_point(): LatLon {
        return {
            lat: (this.n + this.s) / 2,
            lon: (this.w + this.e) / 2
        }
    }

    public get_child(octant: string): LatLonBox {
        let oct_x: number, oct_y: number, oct_z: number;

        const entry = octant_dict[octant];
        if (!entry) {
            throw new Error("Invalid octant value");
        }
        [oct_x, oct_y, oct_z] = entry;

        let n = this.n;
        let s = this.s;
        let w = this.w;
        let e = this.e;

        if (oct_y == 0) {
            n = this.mid_point().lat
        }
        else if (oct_y == 1) {
            s = this.mid_point().lat
        }
        else {
            throw new Error("Invalid y (north or south)")
        }

        if (n == 90 || s == -90) {
            return new LatLonBox(n, s, w, e);
        }

        if (oct_x == 0) {
            e = this.mid_point().lon;
        }
        else if (oct_x == 1) {
            w = this.mid_point().lon
        }
        else {
            throw new Error("Invalid x (east or west)")
        }

        return new LatLonBox(n, s, w, e)
    }

    public static is_overlapping(box1: LatLonBox, box2: LatLonBox): boolean {
        const n = Math.min(box1.n, box2.n)
        const s = Math.max(box1.s, box2.s)
        const w = Math.max(box1.w, box2.w)
        const e = Math.min(box1.e, box2.e)

        return (n >= s) && (w <= e)
    }
}

const first_latlonbox_dict: Record<string, LatLonBox> = {
    '': new LatLonBox(90, -90, -180, 180),
    '0': new LatLonBox(0, -90, -180, 0),
    '1': new LatLonBox(0, -90, 0, 180),
    '2': new LatLonBox(90, 0, -180, 0),
    '3': new LatLonBox(90, 0, 0, 180),
    '02': new LatLonBox(0, -90, -180, -90),
    '03': new LatLonBox(0, -90, -90, 0),
    '12': new LatLonBox(0, -90, 0, 90),
    '13': new LatLonBox(0, -90, 90, 180),
    '20': new LatLonBox(90, 0, -180, -90),
    '21': new LatLonBox(90, 0, -90, 0),
    '30': new LatLonBox(90, 0, 0, 90),
    '31': new LatLonBox(90, 0, 90, 180),
}

export function octant_to_latlong(octant_string: string): LatLonBox {
    let latlonbox: LatLonBox = first_latlonbox_dict[octant_string.substring(0, 2)]
    if (!latlonbox) {
        // Fallback for paths not in the initial dictionary
        latlonbox = first_latlonbox_dict[''];
    }
    for (let octant of octant_string.substring(2)) {
        latlonbox = latlonbox.get_child(octant)
    }

    return latlonbox
}
