import { createDefaultDesign, FIELD_LIMITS } from './customSticker';

// Native range describes the species, never the keeper's address or breeder.
// Reference: https://carpenternaturecenter.org/wp-content/uploads/2020/02/Crested-Gecko-Natural-History-PDF.pdf
export const CRESTED_SPECIES = {
  species_name: 'Crested gecko', scientific_name: 'Correlophus ciliatus',
  native_range: 'New Caledonia · South Pacific', habitat: 'Tropical forest canopy',
};

// Scientific names and ranges checked against The Reptile Database.
// https://reptile-database.reptarium.cz/Rhacodactylus/auriculatus
// https://reptile-database.reptarium.cz/Mniarogekko/chahoua
// https://endemia.nc/en/faune/fiche1024
// https://reptile-database.reptarium.cz/Eublepharis/macularius
const SPECIES_DETAILS = {
  'crested gecko': CRESTED_SPECIES,
  'gargoyle gecko': { species_name: 'Gargoyle gecko', scientific_name: 'Rhacodactylus auriculatus', native_range: 'Southern New Caledonia · South Pacific', habitat: '' },
  'chahoua gecko': { species_name: 'Chahoua gecko', scientific_name: 'Mniarogekko chahoua', native_range: 'New Caledonia · South Pacific', habitat: '' },
  'leachianus gecko': { species_name: 'Leachianus gecko', scientific_name: 'Rhacodactylus leachianus', native_range: 'New Caledonia · South Pacific', habitat: '' },
  'leopard gecko': { species_name: 'Leopard gecko', scientific_name: 'Eublepharis macularius', native_range: 'Afghanistan, Pakistan, NW India & Nepal', habitat: '' },
};

export function designFromGecko(gecko, theme = 'trading_card') {
  const species = String(gecko?.species || '').trim();
  const knownSpecies = SPECIES_DETAILS[species.toLowerCase()] || Object.values(SPECIES_DETAILS).find((entry) => entry.scientific_name.toLowerCase() === species.toLowerCase());
  return {
    ...createDefaultDesign(), theme: theme === 'enclosure_plaque' ? theme : 'trading_card',
    name: String(gecko?.name || '').slice(0, FIELD_LIMITS.name),
    morph_line: String(gecko?.morphs_traits || gecko?.morph_tags?.join(', ') || '').slice(0, FIELD_LIMITS.morph_line),
    photo_url: gecko?.image_urls?.[0] || '', photo_path: '',
    hatch_label: String(gecko?.hatch_date || '').slice(0, 14),
    ...(knownSpecies || {
      species_name: species === 'Other' ? '' : species,
      scientific_name: '', native_range: '', habitat: '',
    }),
  };
}

export function stickerGeckoLocation(gecko, theme) {
  return {
    pathname: '/Store/stickers',
    search: theme === 'enclosure_plaque' ? '?theme=enclosure_plaque' : '',
    // Only the fields the builder needs; private notes and ownership stay out.
    state: { stickerGecko: {
      name: gecko.name, species: gecko.species, morphs_traits: gecko.morphs_traits,
      morph_tags: gecko.morph_tags, hatch_date: gecko.hatch_date,
      image_urls: gecko.image_urls?.slice(0, 1) || [],
    } },
  };
}
