import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type PlaceReview = {
  author: string;
  authorPhoto?: string;
  rating: number;
  relativeTime: string;
  text: string;
};

export type PlaceData = {
  placeId: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  openingHours?: string[];
  openNow?: boolean;
  location?: { latitude: number; longitude: number };
  photos: string[];
  reviews: PlaceReview[];
  googleMapsUri?: string;
};

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function gatewayFetch(path: string, init: RequestInit = {}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Maps connector credentials missing");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", connectionKey);
  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers });
  return res;
}

async function resolvePhotoUri(name: string, maxWidth = 1200): Promise<string | null> {
  const res = await gatewayFetch(
    `/places/v1/${name}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { photoUri?: string };
  return data.photoUri ?? null;
}

export const getRestaurantPlace = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; latitude?: number; longitude?: number }) => input)
  .handler(async ({ data }): Promise<PlaceData | null> => {
    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.nationalPhoneNumber",
      "places.internationalPhoneNumber",
      "places.websiteUri",
      "places.rating",
      "places.userRatingCount",
      "places.priceLevel",
      "places.regularOpeningHours",
      "places.currentOpeningHours",
      "places.location",
      "places.photos",
      "places.reviews",
      "places.googleMapsUri",
    ].join(",");

    const body: Record<string, unknown> = {
      textQuery: data.query,
      maxResultCount: 1,
      languageCode: "pt-BR",
      regionCode: "BR",
    };
    if (typeof data.latitude === "number" && typeof data.longitude === "number") {
      body.locationBias = {
        circle: {
          center: { latitude: data.latitude, longitude: data.longitude },
          radius: 25000,
        },
      };
    }

    const res = await gatewayFetch(`/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[places] searchText failed [${res.status}]: ${errText}`);
      return null;
    }

    const json = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        nationalPhoneNumber?: string;
        internationalPhoneNumber?: string;
        websiteUri?: string;
        rating?: number;
        userRatingCount?: number;
        priceLevel?: string;
        regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
        currentOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
        location?: { latitude: number; longitude: number };
        photos?: Array<{ name: string }>;
        reviews?: Array<{
          rating?: number;
          text?: { text?: string };
          originalText?: { text?: string };
          relativePublishTimeDescription?: string;
          authorAttribution?: { displayName?: string; photoUri?: string };
        }>;
        googleMapsUri?: string;
      }>;
    };

    const p = json.places?.[0];
    if (!p) return null;

    const photoNames = (p.photos ?? []).slice(0, 5).map((ph) => ph.name);
    const photoUris = (
      await Promise.all(photoNames.map((n) => resolvePhotoUri(n)))
    ).filter((u): u is string => Boolean(u));

    const hours = p.currentOpeningHours ?? p.regularOpeningHours;

    return {
      placeId: p.id,
      name: p.displayName?.text ?? data.query,
      address: p.formattedAddress,
      phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber,
      website: p.websiteUri,
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      priceLevel: p.priceLevel ? PRICE_LEVEL_MAP[p.priceLevel] : undefined,
      openingHours: hours?.weekdayDescriptions ?? [],
      openNow: hours?.openNow,
      location: p.location,
      photos: photoUris,
      googleMapsUri: p.googleMapsUri,
      reviews: (p.reviews ?? []).slice(0, 6).map((r) => ({
        author: r.authorAttribution?.displayName ?? "Anônimo",
        authorPhoto: r.authorAttribution?.photoUri,
        rating: r.rating ?? 0,
        relativeTime: r.relativePublishTimeDescription ?? "",
        text: r.text?.text ?? r.originalText?.text ?? "",
      })),
    };
  });