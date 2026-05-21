/**
 * GeckoForm shared constants.
 *
 * Pulled out of GeckoForm.jsx so the main file doesn't need to ship
 * static data alongside its component logic. Safe to import anywhere.
 */

export const MONTHS = [
  { value: '1',  label: 'January'   },
  { value: '2',  label: 'February'  },
  { value: '3',  label: 'March'     },
  { value: '4',  label: 'April'     },
  { value: '5',  label: 'May'       },
  { value: '6',  label: 'June'      },
  { value: '7',  label: 'July'      },
  { value: '8',  label: 'August'    },
  { value: '9',  label: 'September' },
  { value: '10', label: 'October'   },
  { value: '11', label: 'November'  },
  { value: '12', label: 'December'  },
];

export const GECKO_SPECIES = [
  'Crested Gecko',
  'Gargoyle Gecko',
  'Giant Day Gecko',
  'Gold Dust Day Gecko',
  'Leachianus Gecko',
  'Mourning Gecko',
  'Chahoua Gecko',
  'Pictus Gecko',
  'Tokay Gecko',
  'Leopard Gecko',
  'African Fat-Tailed Gecko',
  'Other',
];

// Life-stage tags applied per image. Stored in image_crop_data[url].life_stage
// and used by the Growth Slideshow on the gecko detail view. Order here
// determines slideshow order (youngest → oldest).
export const LIFE_STAGES = [
  { value: 'hatchling', label: 'Hatchling' },
  { value: '3mo',       label: '3 months'  },
  { value: '6mo',       label: '6 months'  },
  { value: '1yr',       label: '1 year'    },
  { value: '2yr',       label: '2 years'   },
  { value: 'adult',     label: 'Adult'     },
];

export const INITIAL_FORM_DATA = {
  name: '',
  gecko_id_code: '',
  hatch_date: null,
  sex: 'Unsexed',
  species: 'Crested Gecko',
  sire_id: '',
  dam_id: '',
  morphs_traits: '',
  notes: '',
  status: 'Pet',
  image_urls: [],
  weight_grams: '',
  asking_price: '',
  marketplace_description: '',
  // P11 Quality Scale: 0-10 numeric, NULL when not graded yet.
  // Tier (pet/breeder/high_end/investment) is derived in src/lib/quality.js
  // and mirrored to pattern_grade on save for Market Pricing aggregations.
  quality_score: null,
  // Tail condition. NULL = not recorded; explicit values are intact /
  // dropped / regenerating. Crested geckos do not regrow dropped tails,
  // so "regenerating" is hidden for that species in the form.
  tail_status: null,
  // Per-URL display metadata: { [url]: { x, y, rotation, life_stage } }.
  // x/y are focal-point percentages (0-100), rotation is degrees in
  // 90-step increments, life_stage tags the photo for the slideshow.
  image_crop_data: {},
  // When true, the gecko detail view shows the Growth Slideshow built
  // from images tagged with a life_stage. Falsey hides the toggle.
  growth_slideshow_enabled: false,
  // Collection ownership. Null tells the trigger / save flow to use
  // the user's default collection. Set explicitly when the user
  // picks a non-default collection in the form's "Collection" select.
  collection_id: null,
};

export { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
