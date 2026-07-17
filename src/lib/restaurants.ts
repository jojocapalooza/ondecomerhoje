export type Restaurant = {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  cuisine: string;
  priceLevel: 1 | 2 | 3 | 4;
  distance: number;
  city: string;
  address: string;
  phone: string;
  website?: string;
  photo: string;
  isNew?: boolean;
  promo?: boolean;
  hours: string;
  latitude: number;
  longitude: number;
  menu: { name: string; description: string; price: number; rating: number }[];
  recommended: { name: string; rating: number; mentions: number; quote: string }[];
  userReviews: { user: string; rating: number; date: string; text: string }[];
};

// Fotos representativas por tipo de culinária (Unsplash)
const cuisinePhotos: Record<string, string> = {
  Italiana: "https://images.unsplash.com/photo-1521389508051-d7ffb5dc8d74?w=800&q=80", // massa
  Japonesa: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80", // sushi
  Brasileira: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80", // churrasco
  Chinesa: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=800&q=80", // wok
  Mexicana: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80", // tacos
  Francesa: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80", // bistrô
  "Árabe": "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80", // kebab/grelhados
  Vegetariana: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80", // salada
  "Hambúrguer": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80", // burger
  Pizzaria: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80", // pizza
};
const fallbackPhoto = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80";

export const cuisines = [
  "Italiana",
  "Japonesa",
  "Brasileira",
  "Chinesa",
  "Mexicana",
  "Francesa",
  "Árabe",
  "Vegetariana",
  "Hambúrguer",
  "Pizzaria",
  "Vegan",
  "Pet-friendly",
  "Biológico",
  "Brunch",
  "Rodízio",
];

// Categorias que não são culinárias tradicionais e sim características/estilo.
// Ao selecionar (ou digitar) uma delas, o buscador envia palavras-chave
// adicionais para o Google Places para achar lugares compatíveis.
export const SPECIAL_CATEGORIES = [
  "Vegan",
  "Pet-friendly",
  "Biológico",
  "Brunch",
  "Rodízio",
] as const;

export const CATEGORY_QUERY_TERMS: Record<string, string> = {
  Vegan: "restaurante vegano",
  "Pet-friendly": "restaurante pet friendly",
  "Biológico": "restaurante orgânico biológico",
  Brunch: "brunch café da manhã",
  "Rodízio": "rodízio preço fixo comer à vontade buffet livre all you can eat coma à vontade",
};

const names = [
  "La Trattoria",
  "Sushi House",
  "Fogo Brasil",
  "Dragon Wok",
  "Cantina Rossa",
  "Tokyo Ramen",
  "Boteco do Zé",
  "Le Bistrot",
  "Habibi Grill",
  "Verde Café",
  "Burger Yard",
  "Pizza Napoli",
  "Osteria Nonna",
  "Sakura Sushi",
  "Churrascaria Sul",
  "Xangai Express",
  "Taco Loco",
  "Chez Marie",
  "Casa Árabe",
  "Green Bowl",
];

function seeded(i: number) {
  const x = Math.sin(i * 9999) * 10000;
  return x - Math.floor(x);
}

export const restaurants: Restaurant[] = names.map((name, i) => {
  const cuisine = cuisines[i % cuisines.length];
  const rating = +(3 + seeded(i) * 2).toFixed(1);
  return {
    id: String(i + 1),
    name,
    rating,
    reviews: Math.floor(50 + seeded(i + 3) * 3000),
    cuisine,
    priceLevel: (((i % 4) + 1) as 1 | 2 | 3 | 4),
    distance: +(0.3 + seeded(i + 7) * 12).toFixed(1),
    city: i % 3 === 0 ? "São Paulo" : i % 3 === 1 ? "Rio de Janeiro" : "Belo Horizonte",
    address: `Rua das Flores, ${100 + i * 7} - Centro`,
    phone: `(11) 9${1000 + i}-${2000 + i}`,
    website: i % 2 === 0 ? "https://exemplo.com" : undefined,
    photo: cuisinePhotos[cuisine] ?? fallbackPhoto,
    isNew: i % 6 === 0,
    promo: i % 5 === 0,
    hours: "Seg-Dom: 11h às 23h",
    latitude: -23.55 + seeded(i) * 0.1,
    longitude: -46.63 + seeded(i + 1) * 0.1,
    menu: [
      { name: "Prato Especial da Casa", description: "Receita autêntica com ingredientes selecionados.", price: 68, rating: +(4 + seeded(i + 1)).toFixed(1) > 5 ? 4.9 : +(4 + seeded(i + 1)).toFixed(1) },
      { name: "Entrada Tradicional", description: "Perfeita para começar a refeição.", price: 32, rating: 4.5 },
      { name: "Sobremesa da Casa", description: "Feita artesanalmente.", price: 24, rating: 4.7 },
      { name: "Bebida Signature", description: "Combinação exclusiva do chef.", price: 18, rating: 4.3 },
    ],
    recommended: [
      { name: "Prato Especial da Casa", rating: 4.8, mentions: 142, quote: "Simplesmente incrível, o melhor que já comi!" },
      { name: "Entrada Tradicional", rating: 4.6, mentions: 89, quote: "Muito saboroso, recomendo demais." },
    ],
    userReviews: [
      { user: "Ana Silva", rating: 5, date: "há 2 dias", text: "Ambiente incrível e atendimento impecável. Voltarei com certeza!" },
      { user: "Carlos Mendes", rating: 4, date: "há 1 semana", text: "Comida muito boa, preço justo. Recomendo." },
      { user: "Marina Costa", rating: 5, date: "há 2 semanas", text: "Melhor experiência gastronômica do mês." },
    ],
  };
});

export function ratingColor(r: number) {
  if (r >= 4.5) return "text-success";
  if (r >= 3.5) return "text-warning";
  if (r >= 2.5) return "text-orange-500";
  return "text-destructive";
}

export function priceLabel(p: number) {
  return "$".repeat(p);
}

export function formatReviews(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k avaliações";
  return n + " avaliações";
}