'use strict';

const RE5_GAME_ID = 16;
const RE5_SLUG = 'resident-evil-5';
const RE5_SCHEMA_VERSION = 2;

const RE5_VERSION_CODES = Object.freeze({
  PS4_NATIVE: 'ps4-native',
  PS5_BACKCOMPAT_PS4: 'ps5-backcompat-ps4'
});

const RE5_PACKAGE_CODES = Object.freeze({
  BASE: 'base',
  VERSUS: 'versus',
  LOST_IN_NIGHTMARES: 'lost-in-nightmares',
  DESPERATE_ESCAPE: 'desperate-escape'
});

const RE5_EXPECTED_COUNTS = Object.freeze({
  total: 71,
  base: 51,
  versus: 10,
  'lost-in-nightmares': 5,
  'desperate-escape': 5
});

const RE5_EXPECTED_TYPE_COUNTS = Object.freeze({
  Platina: 1,
  Ouro: 1,
  Prata: 16,
  Bronze: 53
});

const RE5_EXPECTED_STRUCTURED_COUNTS = Object.freeze({
  roadmap: 9,
  guideContent: 31,
  bsaaEmblems: 30,
  treasures: 50,
  inventoryRequirements: 27,
  upgradeRequirements: 18
});

const RE5_STAGE_CODES = Object.freeze(
  Array.from({ length: 9 }, (_, index) => `re5-stage-${String(index + 1).padStart(2, '0')}`)
);

const RE5_GUIDE_SECTION_CODES = Object.freeze([
  'version-context',
  'summary',
  'critical-warnings',
  'progress-behavior',
  'non-shared-conditions',
  'strategic-saves',
  'roadmap',
  'normal-campaign',
  'bsaa-emblems',
  'treasures',
  'chapter-opportunities',
  'amateur-ranks-time',
  'infinite-rocket-launcher',
  'combat-trophies',
  'egg-hunt',
  'all-dressed-up',
  'stockpile',
  'upgrades',
  'money-farm',
  'action-figures',
  'veteran',
  'professional',
  'versus',
  'versus-characters',
  'lost-in-nightmares',
  'score-stars',
  'desperate-escape',
  'agitators',
  'final-verification',
  'sources',
  'review'
]);

const RE5_BASE_TROPHY_CODES = Object.freeze([
  're5_platinum',
  're5_ch1_1',
  're5_ch1_2',
  're5_ch2_1',
  're5_ch2_2',
  're5_ch2_3',
  're5_ch3_1',
  're5_ch3_2',
  're5_ch3_3',
  're5_ch4_1',
  're5_ch4_2',
  're5_ch5_1',
  're5_ch5_2',
  're5_ch5_3',
  're5_ch6_1',
  're5_ch6_2',
  're5_ch6_3',
  're5_recruit',
  're5_soldier',
  're5_veteran',
  're5_war_hero',
  're5_egg_hunt',
  're5_all_dressed_up',
  're5_stockpile',
  're5_take_it_to_the_max',
  're5_museum',
  're5_badge_of_honor',
  're5_action_figures',
  're5_friend_in_need',
  're5_lifeguard',
  're5_exploding_heads',
  're5_cut_above',
  're5_cattle_prod',
  're5_crowd_control',
  're5_bulls_eye',
  're5_get_physical',
  're5_the_works',
  're5_lead_aspirin',
  're5_fireworks',
  're5_be_the_knife',
  're5_meat_shower',
  're5_go_into_the_light',
  're5_ride_the_lightning',
  're5_stop_drop_roll',
  're5_baptism_by_fire',
  're5_masters_of_removing',
  're5_bad_blood',
  're5_drive_by',
  're5_egg_on_your_face',
  're5_heart_stopper',
  're5_who_do_you_trust'
]);

const RE5_VERSION_SPECS = Object.freeze([
  Object.freeze({
    versionCode: RE5_VERSION_CODES.PS4_NATIVE,
    platform: 'PS4',
    region: 'global',
    releaseKind: 'native',
    displayOrder: 1,
    isNative: true,
    nativeTrophyList: true,
    saveTransferSupported: true,
    autopopSupported: false,
    upgradeSupported: false,
    sourceVersionCode: null
  }),
  Object.freeze({
    versionCode: RE5_VERSION_CODES.PS5_BACKCOMPAT_PS4,
    platform: 'PS5',
    region: 'global',
    releaseKind: 'backward_compatibility',
    displayOrder: 2,
    isNative: false,
    nativeTrophyList: false,
    saveTransferSupported: true,
    autopopSupported: false,
    upgradeSupported: false,
    sourceVersionCode: RE5_VERSION_CODES.PS4_NATIVE
  })
]);

const RE5_PACKAGE_SPECS = Object.freeze([
  Object.freeze({
    packageCode: RE5_PACKAGE_CODES.BASE,
    name: 'Jogo-base',
    packageType: 'base',
    displayOrder: 1,
    expectedTrophyCount: 51,
    countsForPlatinum: true,
    countsFor100Percent: true,
    isOnline: false,
    isCoop: true
  }),
  Object.freeze({
    packageCode: RE5_PACKAGE_CODES.VERSUS,
    name: 'Versus',
    packageType: 'mode',
    displayOrder: 2,
    expectedTrophyCount: 10,
    countsForPlatinum: false,
    countsFor100Percent: true,
    isOnline: true,
    isCoop: true
  }),
  Object.freeze({
    packageCode: RE5_PACKAGE_CODES.LOST_IN_NIGHTMARES,
    name: 'Lost in Nightmares',
    packageType: 'dlc',
    displayOrder: 3,
    expectedTrophyCount: 5,
    countsForPlatinum: false,
    countsFor100Percent: true,
    isOnline: false,
    isCoop: true
  }),
  Object.freeze({
    packageCode: RE5_PACKAGE_CODES.DESPERATE_ESCAPE,
    name: 'Desperate Escape',
    packageType: 'dlc',
    displayOrder: 4,
    expectedTrophyCount: 5,
    countsForPlatinum: false,
    countsFor100Percent: true,
    isOnline: false,
    isCoop: true
  })
]);

const RE5_ADDITIONAL_TROPHIES = Object.freeze([
  ...Array.from({ length: 10 }, (_, index) => Object.freeze({
    trophyCode: `re5_versus_${String(index + 1).padStart(3, '0')}`,
    packageCode: RE5_PACKAGE_CODES.VERSUS,
    displayOrder: index + 1,
    type: [2, 3, 9].includes(index) ? 'Prata' : 'Bronze',
    isOnline: true
  })),
  ...Array.from({ length: 5 }, (_, index) => Object.freeze({
    trophyCode: `re5_lost_${String(index + 1).padStart(3, '0')}`,
    packageCode: RE5_PACKAGE_CODES.LOST_IN_NIGHTMARES,
    displayOrder: index + 1,
    type: index === 2 ? 'Prata' : 'Bronze',
    isOnline: false
  })),
  ...Array.from({ length: 5 }, (_, index) => Object.freeze({
    trophyCode: `re5_desperate_${String(index + 1).padStart(3, '0')}`,
    packageCode: RE5_PACKAGE_CODES.DESPERATE_ESCAPE,
    displayOrder: index + 1,
    type: index === 2 ? 'Prata' : 'Bronze',
    isOnline: false
  }))
]);

module.exports = {
  RE5_GAME_ID,
  RE5_SLUG,
  RE5_SCHEMA_VERSION,
  RE5_VERSION_CODES,
  RE5_PACKAGE_CODES,
  RE5_EXPECTED_COUNTS,
  RE5_EXPECTED_TYPE_COUNTS,
  RE5_EXPECTED_STRUCTURED_COUNTS,
  RE5_STAGE_CODES,
  RE5_GUIDE_SECTION_CODES,
  RE5_BASE_TROPHY_CODES,
  RE5_VERSION_SPECS,
  RE5_PACKAGE_SPECS,
  RE5_ADDITIONAL_TROPHIES
};
