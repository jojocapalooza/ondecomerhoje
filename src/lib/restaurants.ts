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

const photos = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
  "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
  "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80",
  "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=800&q=80",
  "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80",
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
];

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
];

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
    photo: photos[i % photos.length],
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