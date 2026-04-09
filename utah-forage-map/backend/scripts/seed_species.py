"""
Seed script: inserts Utah mushroom species into the database.
Idempotent — skips any species whose latin_name already exists.

Usage (from backend/):
    python scripts/seed_species.py
"""

import sys
import uuid
from pathlib import Path

# Allow imports from backend/app/ when run as `python scripts/seed_species.py`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.models import Species  # noqa: E402

# ---------------------------------------------------------------------------
# Species data
# ---------------------------------------------------------------------------

SPECIES: list[dict] = [
    {
        "common_name": "Chanterelle",
        "latin_name": "Cantharellus cibarius",
        "edibility": "choice edible",
        "look_alikes": (
            "Jack-o'-lantern mushroom (Omphalotus olearius) — glows faintly in the dark, "
            "grows in dense clusters at wood base, true gills. "
            "False chanterelle (Hygrophoropsis aurantiaca) — forking true gills (not ridges), "
            "more uniform orange, strong odor."
        ),
        "habitat_notes": (
            "Mycorrhizal with Gambel oak and mixed conifer (white fir, ponderosa pine). "
            "Favors well-drained slopes with duff cover. Appears after monsoon rains."
        ),
        "peak_months": "7,8,9",
        "elevation_min_ft": 6500,
        "elevation_max_ft": 9500,
        "utah_regions": "Wasatch Front, Manti-La Sal NF, Dixie NF",
        "notes": (
            "Distinguished by forked blunt ridges (not true gills) running partway down stem, "
            "fruity apricot odor, and egg-yolk yellow color. Found scattered or solitary."
        ),
    },
    {
        "common_name": "Golden chanterelle",
        "latin_name": "Cantharellus roseocanus",
        "edibility": "choice edible",
        "look_alikes": (
            "Jack-o'-lantern mushroom (Omphalotus olearius) — true gills, clusters at wood base. "
            "False chanterelle (Hygrophoropsis aurantiaca) — true gills, more orange, "
            "thinner flesh. "
            "Common chanterelle (C. cibarius) — practically identical; both edible."
        ),
        "habitat_notes": (
            "Conifer forests dominated by Engelmann spruce and subalpine fir; "
            "occasionally with lodgepole pine at upper elevations."
        ),
        "peak_months": "8,9",
        "elevation_min_ft": 7000,
        "elevation_max_ft": 10000,
        "utah_regions": "Uinta Mountains, Boulder Mountain, La Sal Mountains",
        "notes": (
            "Often shows pinkish-rosy tones on cap center. "
            "Typically found at higher elevations than C. cibarius in Utah. "
            "Slightly more robust flesh than common chanterelle."
        ),
    },
    {
        "common_name": "Morel",
        "latin_name": "Morchella americana",
        "edibility": "choice edible",
        "look_alikes": (
            "False morel / Gyromitra (Gyromitra esculenta) — brain-like saddle-shaped cap, "
            "not honeycomb pits, stem may be chambered but not hollow end-to-end — contains "
            "gyromitrin, potentially fatal. "
            "Early morel / Wrinkled thimble cap (Verpa bohemica) — cap attached only at apex "
            "of stem, deeply wrinkled but not pitted."
        ),
        "habitat_notes": (
            "Riparian cottonwood and box elder stands; disturbed soil in canyon mouths; "
            "old apple orchards; burn areas one year post-fire. "
            "Follows snowmelt up elevation gradients April–June."
        ),
        "peak_months": "4,5,6",
        "elevation_min_ft": 4500,
        "elevation_max_ft": 7500,
        "utah_regions": "Statewide canyon systems, Wasatch foothills, southern Utah riparian corridors",
        "notes": (
            "CRITICAL ID: cut stem base to base — true morels are entirely hollow. "
            "Cap is attached to stem at its very base. Must be cooked; raw morels cause illness. "
            "Track snowmelt line for timing; follow cottonwood leaf-out."
        ),
    },
    {
        "common_name": "Black morel",
        "latin_name": "Morchella importuna",
        "edibility": "choice edible",
        "look_alikes": (
            "False morel / Gyromitra (Gyromitra esculenta) — brain-like cap, not pitted, "
            "chambered (not hollow) — potentially fatal gyromitrin toxin. "
            "Verpa bohemica — cap attached only at top, wrinkled not pitted. "
            "Half-free morel (Morchella punctipes) — cap attached midway up stem."
        ),
        "habitat_notes": (
            "Disturbed ground, post-wildfire hillsides (especially with Douglas-fir), "
            "landscaping bark mulch, roadsides. Proliferates dramatically the year after wildfires."
        ),
        "peak_months": "5,6",
        "elevation_min_ft": 5000,
        "elevation_max_ft": 8000,
        "utah_regions": "Post-fire areas statewide, Manti-La Sal NF, Wasatch burn sites",
        "notes": (
            "Check prior-year wildfire burn areas — can fruit in enormous numbers. "
            "Darker cap ridges than M. americana; vertical ridge orientation. "
            "Entirely hollow when sliced; must be cooked thoroughly."
        ),
    },
    {
        "common_name": "Porcini / King bolete",
        "latin_name": "Boletus edulis",
        "edibility": "choice edible",
        "look_alikes": (
            "Satan's bolete (Rubroboletus satanas) — red pore surface, bruises blue intensely, "
            "causes severe GI illness. "
            "Bitter bolete (Tylopilus felleus) — pink pore surface, intensely bitter taste "
            "(spit-it-out test). "
            "Any bolete with red/orange pores or that stains blue should be avoided."
        ),
        "habitat_notes": (
            "Mycorrhizal with Engelmann spruce, subalpine fir, and mixed conifers at high elevation. "
            "Prefers cool north-facing slopes with deep duff after monsoon moisture."
        ),
        "peak_months": "8,9",
        "elevation_min_ft": 8000,
        "elevation_max_ft": 11000,
        "utah_regions": "Uinta Mountains, La Sal Mountains, Boulder Mountain",
        "notes": (
            "White raised network (reticulation) on upper stem is diagnostic. "
            "Pores white when young, yellow-green when old; do NOT stain blue. "
            "Check rim of cap for worm damage before collecting. "
            "Peak after August monsoon rains at elevation."
        ),
    },
    {
        "common_name": "Slippery jack",
        "latin_name": "Suillus luteus",
        "edibility": "edible",
        "look_alikes": (
            "Other Suillus species — most are edible but some cause GI upset in sensitive individuals. "
            "Larch bolete (Suillus grevillei) — grows only with larch, similar slimy cap. "
            "Generally low-risk genus; avoid if cap doesn't peel or ring is absent."
        ),
        "habitat_notes": (
            "Strictly mycorrhizal with ponderosa pine and occasionally lodgepole pine. "
            "Sandy or gravelly soil. Ring on stem and slimy purplish-brown cap are diagnostic."
        ),
        "peak_months": "7,8,9",
        "elevation_min_ft": 6000,
        "elevation_max_ft": 9000,
        "utah_regions": "Ponderosa pine zones statewide, Markagunt Plateau, Manti-La Sal NF",
        "notes": (
            "Peel slimy cap skin before cooking — reduces GI upset. "
            "White ring on stem is persistent and distinctive. "
            "Soft texture; best when young and firm. Some people are sensitive to this genus."
        ),
    },
    {
        "common_name": "Oyster mushroom",
        "latin_name": "Pleurotus ostreatus",
        "edibility": "choice edible",
        "look_alikes": (
            "Angel wings (Pleurocybella porrigens) — white, small, thin, grows on conifer logs, "
            "suspected toxic (especially to those with kidney disease). "
            "Mock oyster (Phyllotopsis nidulans) — bright orange-yellow, foul rotting-cabbage odor. "
            "Crepidotus species — small, brown-spored, on dead wood."
        ),
        "habitat_notes": (
            "Dead or dying cottonwood, box elder, and willow in riparian corridors. "
            "Grows in shelf-like overlapping clusters on wood. Year-round in mild conditions."
        ),
        "peak_months": "1,2,3,4,10,11,12",
        "elevation_min_ft": 4000,
        "elevation_max_ft": 7000,
        "utah_regions": "Riparian corridors statewide, Provo River, Price River, Virgin River drainages",
        "notes": (
            "Gills run down the stem (decurrent); white spore print. "
            "Best in fall and mild winter; look after rainy periods Oct–Mar on cottonwood. "
            "Cultivated varieties widely available; wild specimens more flavorful."
        ),
    },
    {
        "common_name": "Lion's mane",
        "latin_name": "Hericium erinaceus",
        "edibility": "choice edible",
        "look_alikes": (
            "Other Hericium species (H. coralloides — branching; H. americanum — branching coral-like) "
            "— all edible, no dangerous lookalikes exist within the Hericium genus. "
            "White cascading teeth on hardwood are essentially unmistakable."
        ),
        "habitat_notes": (
            "Wounds, scars, and hollows of living hardwoods; dead logs and stumps of "
            "oak, maple, and cottonwood. Single large fruiting body."
        ),
        "peak_months": "9,10",
        "elevation_min_ft": 5000,
        "elevation_max_ft": 9000,
        "utah_regions": "Gambel oak zones of Wasatch Front and plateaus, hardwood riparian drainages",
        "notes": (
            "No dangerous lookalikes — one of the safest mushrooms for beginners. "
            "White when fresh, yellowing with age; harvest young for best flavor. "
            "Cook thoroughly; has lobster-like texture. "
            "Being studied for potential neurological health benefits."
        ),
    },
    {
        "common_name": "Chicken of the woods",
        "latin_name": "Laetiporus sulphureus",
        "edibility": "edible",
        "look_alikes": (
            "Laetiporus gilbertsonii — western species on conifers; specimens on conifers, "
            "black locust, or eucalyptus cause adverse GI reactions in some people. "
            "Jack-o'-lantern mushroom (Omphalotus olearius) — has gills not pores, "
            "grows in clusters at wood base."
        ),
        "habitat_notes": (
            "Parasitic/saprotrophic on Gambel oak, cottonwood, and willow. "
            "Grows as overlapping sulfur-yellow and orange shelves on trunks and stumps."
        ),
        "peak_months": "7,8,9,10",
        "elevation_min_ft": 4500,
        "elevation_max_ft": 8000,
        "utah_regions": "Gambel oak zones statewide, Wasatch foothills, southern Utah canyon riparian",
        "notes": (
            "Harvest only bright, tender growth at margins — tough inner portions are inedible. "
            "Avoid specimens growing on conifer, locust, or eucalyptus. "
            "Cook thoroughly; causes reactions in some people even when properly prepared. "
            "Bright color makes it visible from a distance."
        ),
    },
    {
        "common_name": "Hen of the woods / Maitake",
        "latin_name": "Grifola frondosa",
        "edibility": "choice edible",
        "look_alikes": (
            "Berkeley's polypore (Bondarzewia berkeleyi) — similar overlapping frond habit "
            "at oak base, edible but much tougher; pores larger. "
            "Umbrella polypore (Polyporus umbellatus) — smaller individual caps, "
            "central stem structure, edible."
        ),
        "habitat_notes": (
            "Base of mature living Gambel oak, occasionally on stumps. "
            "Returns to the same tree for many years. Massive fruiting bodies possible."
        ),
        "peak_months": "9,10",
        "elevation_min_ft": 5000,
        "elevation_max_ft": 8000,
        "utah_regions": "Gambel oak zones of Wasatch Front, Manti-La Sal NF, southern Utah plateaus",
        "notes": (
            "Smoke-gray overlapping fronds with white pore surface underneath. "
            "Returns to same host tree annually — mark locations. "
            "Can weigh 20+ lbs. Highly prized in Japanese cuisine. "
            "White pores (not gills) confirm ID."
        ),
    },
    {
        "common_name": "Matsutake",
        "latin_name": "Tricholoma magnivelare",
        "edibility": "choice edible",
        "look_alikes": (
            "DEADLY — Destroying angel (Amanita bisporigera / A. ocreata) — pure white, "
            "similar habitat, has volva (cup) at base, ring on stem, white gills. "
            "DEADLY — Smith's amanita (Amanita smithiana) — causes kidney failure, "
            "similar spicy aroma, white, has volva. "
            "ALWAYS dig carefully and confirm no volva at base before eating."
        ),
        "habitat_notes": (
            "Sandy, well-drained soil under ponderosa pine and lodgepole pine. "
            "Forms arcs and fairy rings in deep duff. Often buried at emergence."
        ),
        "peak_months": "8,9,10",
        "elevation_min_ft": 7000,
        "elevation_max_ft": 10000,
        "utah_regions": "Uinta Mountains, Wasatch Plateau, Boulder Mountain ponderosa pine zones",
        "notes": (
            "CRITICAL: distinctive spicy-cinnamon-and-dirty-sock aroma is key. "
            "White firm flesh; cottony veil remnants hang from cap edge. "
            "ALWAYS dig to base and confirm NO volva (cup) — deadly Amanita species share habitat. "
            "Commercially valuable; can be sold for very high prices."
        ),
    },
    {
        "common_name": "Shaggy mane",
        "latin_name": "Coprinus comatus",
        "edibility": "edible",
        "look_alikes": (
            "Common ink cap (Coprinopsis atramentaria) — shorter, gray-brown scaly cap, "
            "no shaggy scales; causes coprine poisoning when combined with alcohol "
            "(Antabuse-like reaction for up to 72 hours). "
            "Magpie inkcap (Coprinopsis picacea) — black-and-white pattern, mildly toxic."
        ),
        "habitat_notes": (
            "Disturbed nutrient-rich soil: roadsides, lawns, golf courses, parks, "
            "compost areas, meadows. Fruits in troops after rain."
        ),
        "peak_months": "5,6,9,10",
        "elevation_min_ft": 4000,
        "elevation_max_ft": 8000,
        "utah_regions": "Urban areas statewide, disturbed meadows and roadsides throughout Utah",
        "notes": (
            "Harvest before gills begin blackening (auto-digestion/deliquescence). "
            "Cook and eat same day — does not store. "
            "Unmistakable shaggy white cylindrical cap. "
            "To be safe, avoid alcohol 24–72 hours after eating (though C. comatus itself "
            "lacks coprine, confusion with ink caps is possible)."
        ),
    },
    {
        "common_name": "Giant puffball",
        "latin_name": "Calvatia gigantea",
        "edibility": "edible",
        "look_alikes": (
            "DEADLY — Amanita eggs (immature Amanita buttons) — white, round, "
            "buried or partly buried; cut reveals outline of developing gills inside — DO NOT EAT. "
            "Pigskin poison puffball (Scleroderma citrinum) — thick corky skin, "
            "purple-black interior, toxic. "
            "Earthball (Scleroderma spp.) — hard, smaller, dark interior."
        ),
        "habitat_notes": (
            "Open meadows, grassy forest edges, river bottoms, and clearings. "
            "Often near tree lines or in partial shade. Fruits after summer rains."
        ),
        "peak_months": "7,8,9",
        "elevation_min_ft": 4500,
        "elevation_max_ft": 9000,
        "utah_regions": "Mountain meadows statewide, valley bottoms, subalpine clearings",
        "notes": (
            "CRITICAL: always slice completely through before eating — interior must be "
            "pure, uniform white with no outlines, colors, or chambers. "
            "Any purple, yellow, or hint of gill structure inside means discard immediately. "
            "Can reach volleyball size. Slice and sauté like tofu when young and firm."
        ),
    },
    {
        "common_name": "Desert puffball",
        "latin_name": "Calvatia booniana",
        "edibility": "edible",
        "look_alikes": (
            "Pigskin poison puffball (Scleroderma citrinum) — thick hard corky skin, "
            "purple-black interior when cut, toxic. "
            "Earthballs (Scleroderma spp.) — smaller, hard exterior, dark purple interior. "
            "Always cut in half — white interior only."
        ),
        "habitat_notes": (
            "Desert shrub-steppe, sagebrush flats, pinyon-juniper woodland, "
            "and semi-arid grasslands. Appears after winter and early spring rains, "
            "and again in fall."
        ),
        "peak_months": "3,4,5,10",
        "elevation_min_ft": 2500,
        "elevation_max_ft": 5500,
        "utah_regions": "Colorado Plateau, Great Basin, Canyonlands, San Rafael Swell, Uinta Basin",
        "notes": (
            "Largest puffball of the American West — can exceed 2 feet across. "
            "Pyramid-like scales on exterior when young. "
            "Unique spring/fall seasonality tied to desert rain patterns. "
            "Always verify pure white solid interior before eating."
        ),
    },
    {
        "common_name": "Velvet foot / Enoki",
        "latin_name": "Flammulina velutipes",
        "edibility": "edible",
        "look_alikes": (
            "DEADLY — Funeral bell / Deadly Galerina (Galerina marginata) — grows in "
            "same habitat and same season on same wood; brown cap, brown gills, ring on stem, "
            "brown spore print — contains amatoxins (same as death cap). "
            "ALWAYS take a white spore print to confirm (Flammulina = white; Galerina = brown/rusty). "
            "Deadly gallerinas are easy to confuse — this is the #1 risk with wild enoki."
        ),
        "habitat_notes": (
            "Dead cottonwood, willow, and poplar stumps and logs in riparian corridors. "
            "Uniquely cold-adapted; fruits in fall through early spring, including under snow."
        ),
        "peak_months": "10,11,12,1,2,3",
        "elevation_min_ft": 4000,
        "elevation_max_ft": 7500,
        "utah_regions": "Riparian cottonwood corridors statewide, Wasatch Front valleys, canyon riparian",
        "notes": (
            "Wild enoki has a dark brown velvety stem base — very different from white "
            "grocery-store cultivated enoki. "
            "CRITICAL: always take white spore print before eating. "
            "Deadly Galerina marginata grows alongside in same habitat, same season. "
            "Small size (2–8cm cap) with orange-brown cap; gills whitish."
        ),
    },
]


# ---------------------------------------------------------------------------
# Seeding logic
# ---------------------------------------------------------------------------

def seed() -> None:
    db = SessionLocal()
    try:
        inserted = 0
        skipped = 0

        for data in SPECIES:
            existing = (
                db.query(Species)
                .filter(Species.latin_name == data["latin_name"])
                .first()
            )
            if existing:
                print(f"  skip  {data['common_name']} ({data['latin_name']}) — already in database")
                skipped += 1
                continue

            species = Species(id=uuid.uuid4(), **data)
            db.add(species)
            db.flush()  # catch constraint errors early
            print(f"  added {data['common_name']} ({data['latin_name']})")
            inserted += 1

        db.commit()
        print(f"\nDone — {inserted} inserted, {skipped} skipped.")

    except Exception as exc:
        db.rollback()
        print(f"\nError: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding Utah mushroom species...\n")
    seed()
