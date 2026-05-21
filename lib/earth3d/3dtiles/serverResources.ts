import { Resources } from '../controller/Resources';

// Create a single shared instance of the resources loader pointing to Google Earth
export const globalResources = new Resources("https://kh.google.com/rt/earth/");
