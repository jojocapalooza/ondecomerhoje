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

// Mapeia primaryType do Google → rótulo de culinária em pt-BR
const CUISINE_MAP: Record<string, string> = {
  italian_restaurant: "Italiana",
  pizza_restaurant: "Pizzaria",
  japanese_restaurant: "Japonesa",
  sushi_restaurant: "Japonesa",
  ramen_restaurant: "Japonesa",
  brazilian_restaurant: "Brasileira",
  churrascaria: "Brasileira",
  steak_house: "Brasileira",
  chinese_restaurant: "Chinesa",
  mexican_restaurant: "Mexicana",
  french_restaurant: "Francesa",
  middle_eastern_restaurant: "Árabe",
  lebanese_restaurant: "Árabe",
  vegetarian_restaurant: "Vegetariana",
  vegan_restaurant: "Vegetariana",
  hamburger_restaurant: "Hambúrguer",
  fast_food_restaurant: "Fast Food",
  seafood_restaurant: "Frutos do Mar",
  cafe: "Café",
  bakery: "Padaria",
  bar: "Bar",
  meal_takeaway: "Delivery",
  buffet_restaurant: "Buffet",
};

const FIXED_PRICE_AYCE_POSITIVE =
  /\b(rod[íi]zios?|all[-\s]?you[-\s]?can[-\s]?eat|coma(?:r)?\s+(?:à|a)\s+vontade|(?:à|a)\s+vontade|buffet\s+(?:livre|libre|(?:à|a)\s+vontade|pre[çc]o\s+fixo)|pre[çc]o\s+fixo|valor\s+fixo|fixed\s+price|tenedor\s+libre|espeto\s+corrido|sequ[êe]ncia\s+(?:livre|(?:à|a)\s+vontade))\b/i;

const FIXED_PRICE_AYCE_NEGATIVE =
  /\b(n[aã]o\s+(?:tem|serve|faz|[ée])\s+rod[íi]zio|sem\s+rod[íi]zio|not\s+all[-\s]?you[-\s]?can[-\s]?eat|a\s+la\s+carte|[àa]\s+la\s+carte|por\s+quilo|por\s+kg|buffet\s+por\s+quilo|self[-\s]?service\s+por\s+quilo)\b/i;

function hasFixedPriceAllYouCanEatEvidence(text: string) {
  return FIXED_PRICE_AYCE_POSITIVE.test(text) && !FIXED_PRICE_AYCE_NEGATIVE.test(text);
}

function isFixedPriceAllYouCanEatQuery(query: string) {
  return hasFixedPriceAllYouCanEatEvidence(query) || /\brod[íi]zio\b/i.test(query);
}

function stripAllYouCanEatIntent(query: string) {
  return query
    .replace(FIXED_PRICE_AYCE_POSITIVE, " ")
    .replace(/\b(restaurantes?|comida|perto\s+de\s+mim|buffet|livre|coma|comer|vontade|pre[çc]o|fixo|fixed|price)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFixedPriceAllYouCanEatQueries(query: string) {
  const subject = stripAllYouCanEatIntent(query);
  const prefix = subject ? `${subject} ` : "";
  return [
    `${prefix}rodízio preço fixo`,
    `${prefix}rodizio preço fixo`,
    `${prefix}rodízio à vontade`,
    `${prefix}coma à vontade preço fixo`,
    `${prefix}buffet livre preço fixo`,
    `${prefix}all you can eat fixed price`,
    `${prefix}sequência à vontade preço fixo`,
    `${prefix}espeto corrido preço fixo`,
  ];
}

function mapCuisine(primaryType?: string, displayName?: string) {
  if (primaryType && CUISINE_MAP[primaryType]) return CUISINE_MAP[primaryType];
  if (displayName) return displayName;
  return "Restaurante";
}

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

// Foto genérica por culinária (fallback quando não resolvemos a do Google no listing)
const CUISINE_FALLBACK: Record<string, string> = {
  Italiana: "https://images.unsplash.com/photo-1521389508051-d7ffb5dc8d74?w=800&q=80",
  Japonesa: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80",
  Brasileira: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
  Chinesa: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=800&q=80",
  Mexicana: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80",
  Francesa: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
  "Árabe": "https://images.unsplash.com/photo-1540914124281-342587941389?w=800&q=80",
  Vegetariana: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80",
  "Hambúrguer": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
  Pizzaria: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
  Café: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80",
  Padaria: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80",
  Bar: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&q=80",
  "Frutos do Mar": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80",
};
const DEFAULT_PHOTO = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80";
export function cuisinePhoto(cuisine: string) {
  return CUISINE_FALLBACK[cuisine] ?? DEFAULT_PHOTO;
}

export type NearbyRestaurant = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  priceLevel: 1 | 2 | 3 | 4;
  address: string;
  latitude: number;
  longitude: number;
  photo: string;
  openNow?: boolean;
  allYouCanEat?: boolean;
};

type SearchPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  currentOpeningHours?: { openNow?: boolean };
  photos?: Array<{ name: string }>;
  types?: string[];
};

const LIST_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.location",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.currentOpeningHours",
  "places.photos",
].join(",");

async function toNearby(p: SearchPlace): Promise<NearbyRestaurant> {
  const cuisine = mapCuisine(p.primaryType, p.primaryTypeDisplayName?.text);
  // Primeira foto do Google Maps do restaurante (fachada/interior).
  // Fallback para imagem genérica por culinária apenas se o place não tiver fotos.
  const firstPhotoName = p.photos?.[0]?.name;
  let photo: string | null = null;
  if (firstPhotoName) {
    photo = await resolvePhotoUri(firstPhotoName, 800);
  }
  return {
    id: p.id,
    name: p.displayName?.text ?? "Restaurante",
    cuisine,
    rating: p.rating ?? 0,
    reviews: p.userRatingCount ?? 0,
    priceLevel: (p.priceLevel ? PRICE_LEVEL_MAP[p.priceLevel] ?? 2 : 2) as 1 | 2 | 3 | 4,
    address: p.formattedAddress ?? "",
    latitude: p.location?.latitude ?? 0,
    longitude: p.location?.longitude ?? 0,
    photo: photo ?? cuisinePhoto(cuisine),
    openNow: p.currentOpeningHours?.openNow,
    allYouCanEat: hasFixedPriceAllYouCanEatEvidence(
      [
        p.displayName?.text,
        cuisine,
        p.primaryType,
        p.primaryTypeDisplayName?.text,
        ...(p.types ?? []),
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

async function fetchFixedPriceAllYouCanEatEvidence(placeId: string, regionCode?: string) {
  const fieldMask = [
    "id",
    "displayName",
    "primaryType",
    "primaryTypeDisplayName",
    "types",
    "editorialSummary",
    "reviews",
  ].join(",");
  const res = await gatewayFetch(
    `/places/v1/places/${placeId}?languageCode=pt-BR&regionCode=${regionCode ?? "BR"}`,
    { method: "GET", headers: { "X-Goog-FieldMask": fieldMask } },
  );
  if (!res.ok) return false;
  const place = (await res.json()) as {
    displayName?: { text?: string };
    primaryType?: string;
    primaryTypeDisplayName?: { text?: string };
    types?: string[];
    editorialSummary?: { text?: string };
    reviews?: Array<{ text?: { text?: string }; originalText?: { text?: string } }>;
  };
  const evidence = [
    place.displayName?.text,
    place.primaryType,
    place.primaryTypeDisplayName?.text,
    ...(place.types ?? []),
    place.editorialSummary?.text,
    ...(place.reviews ?? []).flatMap((review) => [review.text?.text, review.originalText?.text]),
  ]
    .filter(Boolean)
    .join(" ");
  return hasFixedPriceAllYouCanEatEvidence(evidence);
}

// Busca restaurantes próximos à localização do usuário
export const searchNearbyRestaurants = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      latitude: number;
      longitude: number;
      radius?: number; // metros (max 50000)
      languageCode?: string;
      regionCode?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<NearbyRestaurant[]> => {
    const body = {
      includedTypes: ["restaurant"],
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      languageCode: data.languageCode ?? "pt-BR",
      regionCode: data.regionCode ?? "BR",
      locationRestriction: {
        circle: {
          center: { latitude: data.latitude, longitude: data.longitude },
          radius: Math.min(data.radius ?? 5000, 50000),
        },
      },
    };
    const res = await gatewayFetch(`/places/v1/places:searchNearby`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-FieldMask": LIST_FIELD_MASK },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[places] searchNearby failed [${res.status}]: ${await res.text()}`);
      return [];
    }
    const json = (await res.json()) as { places?: SearchPlace[] };
    return Promise.all((json.places ?? []).map(toNearby));
  });

// Busca por texto (nome/culinária) próximo à localização
export const searchRestaurantsByText = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      query: string;
      latitude?: number;
      longitude?: number;
      radius?: number;
      languageCode?: string;
      regionCode?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<NearbyRestaurant[]> => {
    const isAyceSearch = isFixedPriceAllYouCanEatQuery(data.query);
    const queries = isAyceSearch ? buildFixedPriceAllYouCanEatQueries(data.query) : [data.query];
    const search = async (textQuery: string, maxResultCount = 20) => {
      const body: Record<string, unknown> = {
        textQuery,
        maxResultCount,
        includedType: "restaurant",
        languageCode: data.languageCode ?? "pt-BR",
        regionCode: data.regionCode ?? "BR",
      };
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        body.locationBias = {
          circle: {
            center: { latitude: data.latitude, longitude: data.longitude },
            radius: Math.min(data.radius ?? (isAyceSearch ? 25000 : 10000), 50000),
          },
        };
      }
      const res = await gatewayFetch(`/places/v1/places:searchText`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-FieldMask": LIST_FIELD_MASK },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(`[places] searchText list failed [${res.status}]: ${await res.text()}`);
        return [] as SearchPlace[];
      }
      const json = (await res.json()) as { places?: SearchPlace[] };
      return json.places ?? [];
    };

    const placesById = new Map<string, SearchPlace>();
    const batches = await Promise.all(queries.map((q) => search(q, isAyceSearch ? 8 : 20)));
    for (const place of batches.flat()) {
      if (!placesById.has(place.id)) placesById.set(place.id, place);
    }

    const mapped = await Promise.all(Array.from(placesById.values()).map(toNearby));
    if (!isAyceSearch) return mapped;

    const enriched = await Promise.all(
      mapped.map(async (restaurant) => ({
        ...restaurant,
        allYouCanEat:
          restaurant.allYouCanEat ||
          (await fetchFixedPriceAllYouCanEatEvidence(restaurant.id, data.regionCode)),
      })),
    );
    return enriched.filter((restaurant) => restaurant.allYouCanEat);
  });

// Reverse geocode → cidade/estado/país do usuário
export type UserPlaceInfo = {
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  formatted?: string;
  latitude: number;
  longitude: number;
};
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input: { latitude: number; longitude: number }) => input)
  .handler(async ({ data }): Promise<UserPlaceInfo> => {
    const res = await gatewayFetch(
      `/maps/api/geocode/json?latlng=${data.latitude},${data.longitude}&language=pt-BR`,
    );
    if (!res.ok) {
      console.error(`[geocode] failed [${res.status}]: ${await res.text()}`);
      return { latitude: data.latitude, longitude: data.longitude };
    }
    const json = (await res.json()) as {
      results?: Array<{
        formatted_address?: string;
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
      }>;
    };
    const comps = json.results?.[0]?.address_components ?? [];
    const pick = (t: string) => comps.find((c) => c.types.includes(t));
    const city = pick("locality")?.long_name ?? pick("administrative_area_level_2")?.long_name;
    const state = pick("administrative_area_level_1")?.long_name;
    const country = pick("country");
    return {
      city,
      state,
      country: country?.long_name,
      countryCode: country?.short_name,
      formatted: json.results?.[0]?.formatted_address,
      latitude: data.latitude,
      longitude: data.longitude,
    };
  });

// Busca detalhes por placeId (para página de detalhe quando id não vem do mock)
export const getPlaceDetailsById = createServerFn({ method: "POST" })
  .inputValidator((input: { placeId: string }) => input)
  .handler(async ({ data }): Promise<PlaceData | null> => {
    const fieldMask = [
      "id",
      "displayName",
      "formattedAddress",
      "nationalPhoneNumber",
      "internationalPhoneNumber",
      "websiteUri",
      "rating",
      "userRatingCount",
      "priceLevel",
      "regularOpeningHours",
      "currentOpeningHours",
      "location",
      "photos",
      "reviews",
      "primaryType",
      "primaryTypeDisplayName",
      "googleMapsUri",
    ].join(",");
    const res = await gatewayFetch(`/places/v1/places/${data.placeId}?languageCode=pt-BR&regionCode=BR`, {
      method: "GET",
      headers: { "X-Goog-FieldMask": fieldMask },
    });
    if (!res.ok) {
      console.error(`[places] details failed [${res.status}]: ${await res.text()}`);
      return null;
    }
    const p = (await res.json()) as {
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
    };
    const photoNames = (p.photos ?? []).slice(0, 5).map((ph) => ph.name);
    const photoUris = (
      await Promise.all(photoNames.map((n) => resolvePhotoUri(n)))
    ).filter((u): u is string => Boolean(u));
    const hours = p.currentOpeningHours ?? p.regularOpeningHours;
    return {
      placeId: p.id,
      name: p.displayName?.text ?? "Restaurante",
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