/**
 * Everything the genetics calculator draws below its loading spinner: the
 * gene pickers, the results and the season simulator, which need the
 * genetics engine (crested-gecko-app and its schema library, about 37 kB
 * compressed), and the "From my collection" picker with its drop-down
 * code.
 *
 * The calculator page (src/pages/GeneticCalculatorTool.jsx) loads this
 * file with loadCalculatorEngine() in ./calculatorEngine.js while it shows
 * its loading spinner, instead of importing these directly, so the page's
 * header and text can draw before the engine has downloaded. Everything
 * the page needs before the engine (reading a shared link, filling the
 * parents from typed shorthand) comes from the engine-free catalog,
 * src/lib/genetics/calculatorCatalog.js.
 */
export { default as GeneticCalculator } from './GeneticCalculator';
export { default as CalculatorResultSummary } from './CalculatorResultSummary';
export { default as ManualGenotypePicker } from './ManualGenotypePicker';
export { default as BreedingSimulator } from '../innovations/BreedingSimulator';
export { default as CollectionParentPicker } from './CollectionParentPicker';
export { specWithInferredHets } from '@/lib/genetics/collectionSpec';
