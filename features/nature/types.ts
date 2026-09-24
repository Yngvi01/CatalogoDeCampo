export interface NaturePhoto {
  id: number;
  url: string;
  image: string;
  alt: string;
  photographer: string;
}
export interface NaturePhotosResponse {
  photos: NaturePhoto[];
}
