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
  image_crop_data: {},
};

export { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
