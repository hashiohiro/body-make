import type { AppData } from '../types';

/**
 * デモ向けビルドの初期データ。
 *
 * 作成者が実際に使っている記録をそのまま書き出したもので、体組成・筋トレ・種目・
 * プリセット・目標まで一式が入っている。**デモは「開いてすぐ動いている」ことに価値がある**ので、
 * グラフも部位別の配分もレビューも、最初から中身のある状態で見せる。
 *
 * 投入されるのは `npm run build:demo` で作ったビルドの初回起動時だけ
 * （env.ts の IS_DEMO と storage.ts の SEEDED_KEY で管理）。
 * 自分の記録として使うビルドに他人の数字が入ると、消すまで自分の数字が読めない。
 *
 * 配色だけは 'system' に直してある。デモがこちらの好みを押しつける理由がない。
 */
export const SEED_SOURCE = '作成者の記録（2026-07-26 〜 08-29）';

/** そのままでは型が合わないので、読み込み側で sanitizeData を通す前提の生データ */
export const SEED_DATA: unknown = {
  version: 4,
  settings: {
    heightCm: 168,
    targetWeight: 65,
    targetBodyFat: 10,
    targetDate: '2026-10-31',
    theme: 'system',
  },
  entries: {
    '2026-07-26': {
      am: {
        weight: 73.3,
        bodyFat: 19.9,
      },
      pm: {
        weight: 73.9,
        bodyFat: 19.3,
      },
    },
    '2026-07-27': {
      am: {
        weight: 73.9,
        bodyFat: 20,
      },
      pm: {
        weight: 74,
        bodyFat: 20,
      },
    },
    '2026-07-28': {
      am: {
        weight: 73.8,
        bodyFat: 19.4,
      },
      pm: {
        weight: 74.4,
        bodyFat: 18.4,
      },
    },
    '2026-07-29': {
      am: {
        weight: null,
        bodyFat: null,
      },
      pm: {
        weight: 74,
        bodyFat: 18.3,
      },
    },
    '2026-07-30': {
      am: {
        weight: 73.8,
        bodyFat: 19.3,
      },
      pm: {
        weight: 73.2,
        bodyFat: 17.9,
      },
    },
    '2026-07-31': {
      am: {
        weight: 73.4,
        bodyFat: 21.5,
      },
      pm: {
        weight: null,
        bodyFat: null,
      },
    },
    '2026-08-01': {
      am: {
        weight: 74.3,
        bodyFat: 20.3,
      },
      pm: {
        weight: null,
        bodyFat: null,
      },
    },
    '2026-08-02': {
      am: {
        weight: null,
        bodyFat: null,
      },
      pm: {
        weight: 76.3,
        bodyFat: 23.6,
      },
    },
    '2026-08-03': {
      am: {
        weight: 75.9,
        bodyFat: 23.4,
      },
      pm: {
        weight: 74.2,
        bodyFat: 18.8,
      },
    },
    '2026-08-04': {
      am: {
        weight: 74.2,
        bodyFat: 23.4,
      },
      pm: {
        weight: 74.7,
        bodyFat: 22.3,
      },
    },
    '2026-08-05': {
      am: {
        weight: 74,
        bodyFat: 21.4,
      },
      pm: {
        weight: 74.7,
        bodyFat: 20,
      },
    },
    '2026-08-06': {
      am: {
        weight: 74.1,
        bodyFat: 19.5,
      },
      pm: {
        weight: 74.3,
        bodyFat: 19.3,
      },
    },
    '2026-08-07': {
      am: {
        weight: 74,
        bodyFat: 20.8,
      },
      pm: {
        weight: 73.1,
        bodyFat: 18.1,
      },
    },
    '2026-08-08': {
      am: {
        weight: 73.1,
        bodyFat: 20.5,
      },
      pm: {
        weight: 74.7,
        bodyFat: 19.7,
      },
    },
    '2026-08-09': {
      am: {
        weight: 73.7,
        bodyFat: 22.2,
      },
      pm: {
        weight: null,
        bodyFat: null,
      },
    },
    '2026-08-10': {
      am: {
        weight: 74.3,
        bodyFat: 20.1,
      },
      pm: {
        weight: 74.1,
        bodyFat: 19,
      },
    },
    '2026-08-11': {
      am: {
        weight: 74.6,
        bodyFat: 20.5,
      },
      pm: {
        weight: 76.8,
        bodyFat: 19.8,
      },
    },
    '2026-08-12': {
      am: {
        weight: 74.6,
        bodyFat: 20.3,
      },
      pm: {
        weight: 74,
        bodyFat: 15.7,
      },
    },
    '2026-08-13': {
      am: {
        weight: 73.8,
        bodyFat: 15.8,
      },
      pm: {
        weight: 73.7,
        bodyFat: 17.8,
      },
    },
    '2026-08-14': {
      am: {
        weight: 73.6,
        bodyFat: 17,
      },
      pm: {
        weight: 74.8,
        bodyFat: 17.2,
      },
    },
    '2026-08-15': {
      am: {
        weight: 74,
        bodyFat: 16.6,
      },
      pm: {
        weight: 75.5,
        bodyFat: 15.4,
      },
    },
    '2026-08-16': {
      am: {
        weight: 74.3,
        bodyFat: 16.4,
      },
      pm: {
        weight: null,
        bodyFat: null,
      },
    },
    '2026-08-17': {
      am: {
        weight: 75,
        bodyFat: 15.7,
      },
      pm: {
        weight: 74.4,
        bodyFat: 18,
      },
    },
    '2026-08-18': {
      am: {
        weight: 73.8,
        bodyFat: 17,
      },
      pm: {
        weight: 74,
        bodyFat: 17.4,
      },
    },
    '2026-08-19': {
      am: {
        weight: 73.5,
        bodyFat: 17.3,
      },
      pm: {
        weight: 73.7,
        bodyFat: 18,
      },
    },
    '2026-08-20': {
      am: {
        weight: 74,
        bodyFat: 18.2,
      },
      pm: {
        weight: 73.6,
        bodyFat: 18.9,
      },
    },
    '2026-08-21': {
      am: {
        weight: 73.5,
        bodyFat: 17.2,
      },
      pm: {
        weight: 74.2,
        bodyFat: 18.4,
      },
    },
    '2026-08-22': {
      am: {
        weight: 74,
        bodyFat: 17.9,
      },
      pm: {
        weight: 74.7,
        bodyFat: 16.4,
      },
    },
    '2026-08-23': {
      am: {
        weight: 74.7,
        bodyFat: 18.8,
      },
      pm: {
        weight: 75.5,
        bodyFat: 18.4,
      },
    },
    '2026-08-24': {
      am: {
        weight: 75,
        bodyFat: 17.2,
      },
      pm: {
        weight: 74.3,
        bodyFat: 19.5,
      },
    },
    '2026-08-25': {
      am: {
        weight: 74.2,
        bodyFat: 18.8,
      },
      pm: {
        weight: 74,
        bodyFat: 20.3,
      },
    },
    '2026-08-26': {
      am: {
        weight: 74.3,
        bodyFat: 18.3,
      },
      pm: {
        weight: 74.4,
        bodyFat: 17.1,
      },
    },
    '2026-08-27': {
      am: {
        weight: 74.7,
        bodyFat: 16.7,
      },
      pm: {
        weight: 74.5,
        bodyFat: 17.7,
      },
    },
    '2026-08-28': {
      am: {
        weight: 74.3,
        bodyFat: 17.7,
      },
      pm: {
        weight: 75.4,
        bodyFat: 15.9,
      },
    },
    '2026-08-29': {
      am: {
        weight: 74.8,
        bodyFat: 16.6,
      },
      pm: {
        weight: 76.4,
        bodyFat: 17,
      },
    },
  },
  exercises: [
    {
      id: 'ex_squat',
      name: 'スクワット',
      group: 'legs',
      subGroups: [
        {
          group: 'core',
          weight: 0.25,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 33.3,
      goal: {
        type: 'weight',
        value: 130,
      },
      order: 0,
      axial: true,
      minutesPerSet: 4.5,
    },
    {
      id: 'ex_rdl',
      name: 'ルーマニアンデッドリフト',
      group: 'legs',
      subGroups: [
        {
          group: 'back',
          weight: 0.5,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 130,
      },
      order: 1,
      axial: true,
      minutesPerSet: 4.5,
    },
    {
      id: 'ex_leg_extension',
      name: 'レッグエクステンション',
      group: 'legs',
      subGroups: [],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 64,
      },
      order: 2,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_leg_curl',
      name: 'レッグカール',
      group: 'legs',
      subGroups: [],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 64,
      },
      order: 3,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_calf_raise',
      name: 'カーフレイズ',
      group: 'legs',
      subGroups: [],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 130,
      },
      order: 4,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_bench',
      name: 'ベンチプレス（バーベル）',
      group: 'chest',
      subGroups: [
        {
          group: 'shoulders',
          weight: 0.5,
        },
        {
          group: 'arms',
          weight: 0.5,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 40,
      goal: {
        type: 'maintain',
        value: null,
      },
      order: 5,
      axial: false,
      minutesPerSet: 4.5,
    },
    {
      id: 'ex_incline_bench',
      name: 'インクラインベンチプレス（バーベル）',
      group: 'chest',
      subGroups: [
        {
          group: 'shoulders',
          weight: 0.5,
        },
        {
          group: 'arms',
          weight: 0.5,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 60,
      },
      order: 6,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_bb_row',
      name: 'ベントオーバーロウ',
      group: 'back',
      subGroups: [
        {
          group: 'shoulders',
          weight: 0.25,
        },
        {
          group: 'arms',
          weight: 0.5,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 80,
      },
      order: 7,
      axial: true,
      minutesPerSet: null,
    },
    {
      id: 'ex_seated_row',
      name: 'シーテッドロウ',
      group: 'back',
      subGroups: [
        {
          group: 'shoulders',
          weight: 0.25,
        },
        {
          group: 'arms',
          weight: 0.5,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 70,
      },
      order: 8,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_lat_pulldown',
      name: 'ラットプルダウン',
      group: 'back',
      subGroups: [
        {
          group: 'shoulders',
          weight: 0.25,
        },
        {
          group: 'arms',
          weight: 0.5,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 6,
      },
      order: 9,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_pushdown',
      name: 'トライセプスプレスダウン',
      group: 'arms',
      subGroups: [],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 70,
      },
      order: 10,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_wrist_curl',
      name: 'リストカール',
      group: 'arms',
      subGroups: [],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'reps',
        value: 15,
      },
      order: 11,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_reverse_wrist_curl',
      name: 'リバースリストカール',
      group: 'arms',
      subGroups: [],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'reps',
        value: 15,
      },
      order: 12,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_lateral_raise',
      name: 'サイドレイズ',
      group: 'shoulders',
      subGroups: [
        {
          group: 'back',
          weight: 0.25,
        },
      ],
      loadMode: 'perSide',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 7,
      },
      order: 13,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_rear_raise',
      name: 'リアレイズ',
      group: 'shoulders',
      subGroups: [
        {
          group: 'back',
          weight: 0.75,
        },
      ],
      loadMode: 'perSide',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: null,
      order: 14,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_deadlift',
      name: 'デッドリフト',
      group: 'back',
      subGroups: [
        {
          group: 'legs',
          weight: 1,
        },
        {
          group: 'arms',
          weight: 0.25,
        },
        {
          group: 'core',
          weight: 0.5,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 33.3,
      goal: {
        type: 'weight',
        value: 150,
      },
      order: 15,
      axial: true,
      minutesPerSet: 4.5,
    },
    {
      id: 'ex_front_squat',
      name: 'フロントスクワット',
      group: 'legs',
      subGroups: [
        {
          group: 'core',
          weight: 0.5,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 50,
      },
      order: 16,
      axial: true,
      minutesPerSet: null,
    },
    {
      id: 'ex_bulgarian_squat_db',
      name: 'ブルガリアンスクワット（ダンベル）',
      group: 'legs',
      subGroups: [
        {
          group: 'core',
          weight: 0.5,
        },
      ],
      loadMode: 'perSide',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'weight',
        value: 30,
      },
      order: 17,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_pullup',
      name: '懸垂',
      group: 'back',
      subGroups: [
        {
          group: 'shoulders',
          weight: 0.25,
        },
        {
          group: 'arms',
          weight: 0.5,
        },
      ],
      loadMode: 'bodyweight',
      repUnit: 'reps',
      bodyweightFactor: 1,
      rmDivisor: 30,
      goal: {
        type: 'reps',
        value: 12,
      },
      order: 18,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_ohp',
      name: 'ショルダープレス（バーベル）',
      group: 'shoulders',
      subGroups: [
        {
          group: 'arms',
          weight: 0.5,
        },
      ],
      loadMode: 'standard',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: null,
      order: 19,
      axial: true,
      minutesPerSet: 4.5,
    },
    {
      id: 'ex_dips',
      name: 'ディップス',
      group: 'chest',
      subGroups: [
        {
          group: 'shoulders',
          weight: 0.5,
        },
        {
          group: 'arms',
          weight: 0.75,
        },
      ],
      loadMode: 'bodyweight',
      repUnit: 'reps',
      bodyweightFactor: 1,
      rmDivisor: 30,
      goal: null,
      order: 20,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_curl_db',
      name: 'カール（ダンベル）',
      group: 'arms',
      subGroups: [],
      loadMode: 'perSide',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'reps',
        value: 12,
      },
      order: 21,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_reverse_curl_db',
      name: 'リバースカール（ダンベル）',
      group: 'arms',
      subGroups: [],
      loadMode: 'perSide',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'reps',
        value: 12,
      },
      order: 22,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_hammer_curl',
      name: 'ハンマーカール',
      group: 'arms',
      subGroups: [],
      loadMode: 'perSide',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: {
        type: 'reps',
        value: 12,
      },
      order: 23,
      axial: false,
      minutesPerSet: null,
    },
    {
      id: 'ex_ab_roller',
      name: 'アブローラー',
      group: 'core',
      subGroups: [
        {
          group: 'back',
          weight: 0.25,
        },
      ],
      loadMode: 'bodyweight',
      repUnit: 'reps',
      bodyweightFactor: 0.7,
      rmDivisor: 30,
      goal: {
        type: 'reps',
        value: 12,
      },
      order: 24,
      axial: true,
      minutesPerSet: null,
    },
    {
      id: 'ex_db_fly',
      name: 'ダンベルフライ',
      group: 'chest',
      subGroups: [
        {
          group: 'shoulders',
          weight: 0.25,
        },
      ],
      loadMode: 'perSide',
      repUnit: 'reps',
      bodyweightFactor: null,
      rmDivisor: 30,
      goal: null,
      order: 25,
      axial: false,
      minutesPerSet: null,
    },
  ],
  workouts: {
    '2026-08-03': [
      {
        exerciseId: 'ex_squat',
        sets: [
          {
            weight: 80,
            reps: 6,
          },
          {
            weight: 100,
            reps: 6,
          },
          {
            weight: 90,
            reps: 6,
          },
          {
            weight: 90,
            reps: 6,
          },
          {
            weight: 60,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_rdl',
        sets: [
          {
            weight: 80,
            reps: 6,
          },
          {
            weight: 100,
            reps: 6,
          },
          {
            weight: 100,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_curl',
        sets: [
          {
            weight: 50,
            reps: 8,
          },
          {
            weight: 55,
            reps: 6,
          },
          {
            weight: 50,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_calf_raise',
        sets: [
          {
            weight: 100,
            reps: 12,
          },
          {
            weight: 110,
            reps: 12,
          },
          {
            weight: 110,
            reps: 12,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-04': [
      {
        exerciseId: 'ex_bench',
        sets: [
          {
            weight: 60,
            reps: 6,
          },
          {
            weight: 70,
            reps: 4,
          },
          {
            weight: 65,
            reps: 6,
          },
          {
            weight: 65,
            reps: 4,
          },
        ],
      },
      {
        exerciseId: 'ex_bb_row',
        sets: [
          {
            weight: 65,
            reps: 8,
          },
          {
            weight: 65,
            reps: 7,
          },
          {
            weight: 55,
            reps: 8,
          },
          {
            weight: 55,
            reps: 8,
          },
          {
            weight: 40,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_seated_row',
        sets: [
          {
            weight: 50,
            reps: 10,
          },
          {
            weight: 50,
            reps: 10,
          },
          {
            weight: 59,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_pushdown',
        sets: [
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 82,
            reps: 7,
          },
          {
            weight: 72,
            reps: 6,
          },
          {
            weight: 42,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_wrist_curl',
        sets: [
          {
            weight: 10,
            reps: 15,
          },
          {
            weight: 12,
            reps: 15,
          },
          {
            weight: 8,
            reps: 12,
          },
        ],
      },
      {
        exerciseId: 'ex_reverse_wrist_curl',
        sets: [
          {
            weight: 5,
            reps: 10,
          },
          {
            weight: 5,
            reps: 10,
          },
          {
            weight: 5,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-07': [
      {
        exerciseId: 'ex_deadlift',
        sets: [
          {
            weight: 90,
            reps: 10,
          },
          {
            weight: 110,
            reps: 5,
          },
          {
            weight: 100,
            reps: 7,
          },
          {
            weight: 60,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_front_squat',
        sets: [
          {
            weight: 40,
            reps: 10,
          },
          {
            weight: 40,
            reps: 9,
          },
          {
            weight: 30,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_bulgarian_squat_db',
        sets: [
          {
            weight: 12,
            reps: 15,
          },
          {
            weight: 14,
            reps: 10,
          },
          {
            weight: 16,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_extension',
        sets: [
          {
            weight: 50,
            reps: 10,
          },
          {
            weight: 55,
            reps: 12,
          },
          {
            weight: 59,
            reps: 12,
          },
          {
            weight: 45,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_curl',
        sets: [
          {
            weight: 55,
            reps: 8,
          },
          {
            weight: 59,
            reps: 8,
          },
          {
            weight: 55,
            reps: 8,
          },
          {
            weight: 45,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-08': [
      {
        exerciseId: 'ex_pullup',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_ohp',
        sets: [
          {
            weight: 40,
            reps: 8,
          },
          {
            weight: 35,
            reps: 6,
          },
          {
            weight: 30,
            reps: 6,
          },
          {
            weight: 30,
            reps: 4,
          },
        ],
      },
      {
        exerciseId: 'ex_dips',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 6,
          },
        ],
      },
      {
        exerciseId: 'ex_rear_raise',
        sets: [
          {
            weight: 8,
            reps: 10,
          },
          {
            weight: 8,
            reps: 8,
          },
          {
            weight: 6,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_curl_db',
        sets: [
          {
            weight: 10,
            reps: 10,
          },
          {
            weight: 10,
            reps: 10,
          },
          {
            weight: 10,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_reverse_curl_db',
        sets: [
          {
            weight: 8,
            reps: 10,
          },
          {
            weight: 6,
            reps: 10,
          },
          {
            weight: 6,
            reps: 10,
          },
          {
            weight: 7,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-09': [
      {
        exerciseId: 'ex_incline_bench',
        sets: [
          {
            weight: 30,
            reps: 10,
          },
          {
            weight: 35,
            reps: 10,
          },
          {
            weight: 40,
            reps: 5,
          },
          {
            weight: 40,
            reps: 5,
          },
        ],
      },
      {
        exerciseId: 'ex_lat_pulldown',
        sets: [
          {
            weight: 45,
            reps: 10,
          },
          {
            weight: 66,
            reps: 15,
          },
          {
            weight: 66,
            reps: 8,
          },
          {
            weight: 45,
            reps: 10,
          },
          {
            weight: 45,
            reps: 12,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-11': [
      {
        exerciseId: 'ex_squat',
        sets: [
          {
            weight: 60,
            reps: 10,
          },
          {
            weight: 70,
            reps: 10,
          },
          {
            weight: 80,
            reps: 6,
          },
          {
            weight: 90,
            reps: 6,
          },
          {
            weight: 40,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_rdl',
        sets: [
          {
            weight: 60,
            reps: 10,
          },
          {
            weight: 70,
            reps: 10,
          },
          {
            weight: 80,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_extension',
        sets: [
          {
            weight: 50,
            reps: 10,
          },
          {
            weight: 59,
            reps: 10,
          },
          {
            weight: 66,
            reps: 8,
          },
          {
            weight: 45,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_curl',
        sets: [
          {
            weight: 45,
            reps: 6,
          },
          {
            weight: 50,
            reps: 6,
          },
          {
            weight: 54,
            reps: 4,
          },
          {
            weight: 45,
            reps: 5,
          },
        ],
      },
      {
        exerciseId: 'ex_calf_raise',
        sets: [
          {
            weight: 80,
            reps: 20,
          },
          {
            weight: 80,
            reps: 20,
          },
          {
            weight: 80,
            reps: 20,
          },
        ],
      },
      {
        exerciseId: 'ex_pullup',
        sets: [
          {
            weight: null,
            reps: 10,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_dips',
        sets: [
          {
            weight: null,
            reps: 10,
          },
          {
            weight: null,
            reps: 10,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-12': [
      {
        exerciseId: 'ex_bench',
        sets: [
          {
            weight: 65,
            reps: 6,
          },
          {
            weight: 70,
            reps: 6,
          },
          {
            weight: 75,
            reps: 3,
          },
          {
            weight: 65,
            reps: 2,
          },
        ],
      },
      {
        exerciseId: 'ex_bb_row',
        sets: [
          {
            weight: 60,
            reps: 8,
          },
          {
            weight: 50,
            reps: 10,
          },
          {
            weight: 50,
            reps: 10,
          },
          {
            weight: 50,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_seated_row',
        sets: [
          {
            weight: 55,
            reps: 10,
          },
          {
            weight: 59,
            reps: 10,
          },
          {
            weight: 64,
            reps: 6,
          },
          {
            weight: 59,
            reps: 5,
          },
        ],
      },
      {
        exerciseId: 'ex_pushdown',
        sets: [
          {
            weight: 72,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_wrist_curl',
        sets: [
          {
            weight: 10,
            reps: 15,
          },
          {
            weight: 10,
            reps: 15,
          },
          {
            weight: 10,
            reps: 12,
          },
        ],
      },
      {
        exerciseId: 'ex_reverse_wrist_curl',
        sets: [
          {
            weight: 5,
            reps: 15,
          },
          {
            weight: 6,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_hammer_curl',
        sets: [
          {
            weight: 10,
            reps: 10,
          },
          {
            weight: 10,
            reps: 6,
          },
        ],
      },
      {
        exerciseId: 'ex_curl_db',
        sets: [
          {
            weight: 12,
            reps: 10,
          },
          {
            weight: 12,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-14': [
      {
        exerciseId: 'ex_deadlift',
        sets: [
          {
            weight: 100,
            reps: 10,
          },
          {
            weight: 110,
            reps: 6,
          },
          {
            weight: 120,
            reps: 6,
          },
          {
            weight: 70,
            reps: 10,
          },
          {
            weight: 60,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_front_squat',
        sets: [
          {
            weight: 20,
            reps: 10,
          },
          {
            weight: 40,
            reps: 9,
          },
          {
            weight: 45,
            reps: 8,
          },
          {
            weight: 45,
            reps: 8,
          },
          {
            weight: 20,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_bulgarian_squat_db',
        sets: [
          {
            weight: 16,
            reps: 10,
          },
          {
            weight: 18,
            reps: 10,
          },
          {
            weight: 20,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_extension',
        sets: [
          {
            weight: 55,
            reps: 10,
          },
          {
            weight: 59,
            reps: 10,
          },
          {
            weight: 64,
            reps: 12,
          },
          {
            weight: 55,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_curl',
        sets: [
          {
            weight: 55,
            reps: 10,
          },
          {
            weight: 59,
            reps: 10,
          },
          {
            weight: 55,
            reps: 9,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-17': [
      {
        exerciseId: 'ex_squat',
        sets: [
          {
            weight: 80,
            reps: 6,
          },
          {
            weight: 100,
            reps: 6,
          },
          {
            weight: 110,
            reps: 3,
          },
          {
            weight: 110,
            reps: 3,
          },
          {
            weight: 40,
            reps: 10,
          },
          {
            weight: 60,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_rdl',
        sets: [
          {
            weight: 80,
            reps: 8,
          },
          {
            weight: 100,
            reps: 6,
          },
          {
            weight: 110,
            reps: 8,
          },
          {
            weight: 80,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_extension',
        sets: [
          {
            weight: 59,
            reps: 12,
          },
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 68,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_curl',
        sets: [
          {
            weight: 59,
            reps: 10,
          },
          {
            weight: 64,
            reps: 5,
          },
          {
            weight: 59,
            reps: 4,
          },
        ],
      },
      {
        exerciseId: 'ex_calf_raise',
        sets: [
          {
            weight: 100,
            reps: 20,
          },
          {
            weight: 110,
            reps: 20,
          },
          {
            weight: 110,
            reps: 20,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 2,
          },
        ],
      },
    ],
    '2026-08-18': [
      {
        exerciseId: 'ex_bench',
        sets: [
          {
            weight: 70,
            reps: 6,
          },
          {
            weight: 75,
            reps: 4,
          },
          {
            weight: 75,
            reps: 2,
          },
          {
            weight: 80,
            reps: 2,
          },
          {
            weight: 80,
            reps: 1,
          },
          {
            weight: 60,
            reps: 8,
          },
          {
            weight: 60,
            reps: 3,
          },
        ],
      },
      {
        exerciseId: 'ex_bb_row',
        sets: [
          {
            weight: 60,
            reps: 8,
          },
          {
            weight: 60,
            reps: 8,
          },
          {
            weight: 65,
            reps: 6,
          },
          {
            weight: 65,
            reps: 5,
          },
          {
            weight: 50,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_seated_row',
        sets: [
          {
            weight: 59,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 68,
            reps: 5,
          },
          {
            weight: 68,
            reps: 5,
          },
          {
            weight: 64,
            reps: 5,
          },
        ],
      },
      {
        exerciseId: 'ex_pushdown',
        sets: [
          {
            weight: 64,
            reps: 15,
          },
          {
            weight: 64,
            reps: 15,
          },
        ],
      },
      {
        exerciseId: 'ex_wrist_curl',
        sets: [
          {
            weight: 12,
            reps: 15,
          },
          {
            weight: 12,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_reverse_wrist_curl',
        sets: [
          {
            weight: 9,
            reps: 10,
          },
          {
            weight: 8,
            reps: 10,
          },
          {
            weight: 8,
            reps: 7,
          },
          {
            weight: 6,
            reps: 7,
          },
        ],
      },
      {
        exerciseId: 'ex_lateral_raise',
        sets: [
          {
            weight: 9,
            reps: 6,
          },
          {
            weight: 9,
            reps: 6,
          },
          {
            weight: 9,
            reps: 6,
          },
          {
            weight: 9,
            reps: 6,
          },
        ],
      },
      {
        exerciseId: 'ex_rear_raise',
        sets: [
          {
            weight: 9,
            reps: 1,
          },
          {
            weight: 8,
            reps: 6,
          },
          {
            weight: 6,
            reps: 6,
          },
        ],
      },
      {
        exerciseId: 'ex_incline_bench',
        sets: [
          {
            weight: 35,
            reps: 6,
          },
          {
            weight: 40,
            reps: 6,
          },
          {
            weight: 45,
            reps: 6,
          },
          {
            weight: 30,
            reps: 10,
          },
          {
            weight: 20,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-20': [
      {
        exerciseId: 'ex_deadlift',
        sets: [
          {
            weight: 110,
            reps: 6,
          },
          {
            weight: 120,
            reps: 6,
          },
          {
            weight: 130,
            reps: 6,
          },
          {
            weight: 110,
            reps: 10,
          },
          {
            weight: 60,
            reps: 8,
          },
          {
            weight: 90,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_front_squat',
        sets: [
          {
            weight: 45,
            reps: 6,
          },
          {
            weight: 50,
            reps: 8,
          },
          {
            weight: 55,
            reps: 6,
          },
          {
            weight: 55,
            reps: 4,
          },
        ],
      },
      {
        exerciseId: 'ex_bulgarian_squat_db',
        sets: [
          {
            weight: 16,
            reps: 10,
          },
          {
            weight: 20,
            reps: 10,
          },
          {
            weight: 22,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_extension',
        sets: [
          {
            weight: 59,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_curl',
        sets: [
          {
            weight: 59,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_calf_raise',
        sets: [
          {
            weight: 110,
            reps: 20,
          },
          {
            weight: 110,
            reps: 20,
          },
          {
            weight: 110,
            reps: 20,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 6,
          },
        ],
      },
    ],
    '2026-08-22': [
      {
        exerciseId: 'ex_pullup',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 5,
          },
          {
            weight: null,
            reps: 5,
          },
        ],
      },
      {
        exerciseId: 'ex_ohp',
        sets: [
          {
            weight: 45,
            reps: 1,
          },
          {
            weight: 30,
            reps: 10,
          },
          {
            weight: 30,
            reps: 10,
          },
          {
            weight: 40,
            reps: 3,
          },
          {
            weight: 20,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_curl_db',
        sets: [
          {
            weight: 12,
            reps: 10,
          },
          {
            weight: 12,
            reps: 10,
          },
          {
            weight: 10,
            reps: 6,
          },
          {
            weight: 10,
            reps: 6,
          },
        ],
      },
      {
        exerciseId: 'ex_reverse_curl_db',
        sets: [
          {
            weight: 6,
            reps: 12,
          },
          {
            weight: 9,
            reps: 10,
          },
          {
            weight: 9,
            reps: 10,
          },
          {
            weight: 9,
            reps: 5,
          },
        ],
      },
      {
        exerciseId: 'ex_bench',
        sets: [
          {
            weight: 75,
            reps: 4,
          },
          {
            weight: 80,
            reps: 2,
          },
          {
            weight: 60,
            reps: 8,
          },
          {
            weight: 60,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_incline_bench',
        sets: [
          {
            weight: 30,
            reps: 4,
          },
          {
            weight: 20,
            reps: 10,
          },
          {
            weight: 25,
            reps: 6,
          },
          {
            weight: 25,
            reps: 6,
          },
          {
            weight: 20,
            reps: 10,
          },
        ],
      },
    ],
    '2026-08-24': [
      {
        exerciseId: 'ex_squat',
        sets: [
          {
            weight: 80,
            reps: 6,
          },
          {
            weight: 100,
            reps: 6,
          },
          {
            weight: 120,
            reps: 4,
          },
          {
            weight: 80,
            reps: 10,
          },
          {
            weight: 80,
            reps: 10,
          },
          {
            weight: 80,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_rdl',
        sets: [
          {
            weight: 100,
            reps: 6,
          },
          {
            weight: 110,
            reps: 6,
          },
          {
            weight: 120,
            reps: 6,
          },
          {
            weight: 130,
            reps: 6,
          },
          {
            weight: 80,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_extension',
        sets: [
          {
            weight: 64,
            reps: 5,
          },
          {
            weight: 64,
            reps: 5,
          },
          {
            weight: 64,
            reps: 5,
          },
          {
            weight: 64,
            reps: 5,
          },
        ],
      },
      {
        exerciseId: 'ex_leg_curl',
        sets: [
          {
            weight: 64,
            reps: 5,
          },
          {
            weight: 64,
            reps: 5,
          },
          {
            weight: 64,
            reps: 5,
          },
          {
            weight: 64,
            reps: 5,
          },
        ],
      },
      {
        exerciseId: 'ex_calf_raise',
        sets: [
          {
            weight: 120,
            reps: 20,
          },
          {
            weight: 120,
            reps: 20,
          },
          {
            weight: 120,
            reps: 20,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
          {
            weight: null,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-25': [
      {
        exerciseId: 'ex_bench',
        sets: [
          {
            weight: 70,
            reps: 3,
          },
          {
            weight: 80,
            reps: 1,
          },
          {
            weight: 60,
            reps: 10,
          },
          {
            weight: 60,
            reps: 8,
          },
          {
            weight: 50,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_incline_bench',
        sets: [
          {
            weight: 40,
            reps: 3,
          },
          {
            weight: 45,
            reps: 3,
          },
          {
            weight: 30,
            reps: 12,
          },
          {
            weight: 30,
            reps: 12,
          },
          {
            weight: 30,
            reps: 6,
          },
        ],
      },
      {
        exerciseId: 'ex_lateral_raise',
        sets: [
          {
            weight: 6,
            reps: 12,
          },
          {
            weight: 6,
            reps: 12,
          },
          {
            weight: 6,
            reps: 10,
          },
          {
            weight: 6,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_rear_raise',
        sets: [
          {
            weight: 6,
            reps: 8,
          },
          {
            weight: 6,
            reps: 6,
          },
          {
            weight: 3,
            reps: 10,
          },
          {
            weight: 4,
            reps: 10,
          },
          {
            weight: 4,
            reps: 10,
          },
          {
            weight: 4,
            reps: 8,
          },
        ],
      },
    ],
    '2026-08-26': [
      {
        exerciseId: 'ex_seated_row',
        sets: [
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_pushdown',
        sets: [
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
          {
            weight: 64,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_wrist_curl',
        sets: [
          {
            weight: 12,
            reps: 10,
          },
          {
            weight: 12,
            reps: 10,
          },
          {
            weight: 12,
            reps: 10,
          },
          {
            weight: 12,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_reverse_wrist_curl',
        sets: [
          {
            weight: 6,
            reps: 15,
          },
          {
            weight: 6,
            reps: 12,
          },
          {
            weight: 6,
            reps: 12,
          },
          {
            weight: 6,
            reps: 12,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 12,
          },
          {
            weight: null,
            reps: 12,
          },
          {
            weight: null,
            reps: 12,
          },
        ],
      },
      {
        exerciseId: 'ex_hammer_curl',
        sets: [
          {
            weight: 10,
            reps: 10,
          },
          {
            weight: 10,
            reps: 10,
          },
          {
            weight: 10,
            reps: 10,
          },
        ],
      },
    ],
    '2026-08-27': [
      {
        exerciseId: 'ex_bulgarian_squat_db',
        sets: [
          {
            weight: 20,
            reps: 10,
          },
          {
            weight: 22,
            reps: 10,
          },
          {
            weight: 24,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 15,
          },
          {
            weight: null,
            reps: 15,
          },
          {
            weight: null,
            reps: 15,
          },
        ],
      },
      {
        exerciseId: 'ex_deadlift',
        sets: [
          {
            weight: 110,
            reps: 8,
          },
          {
            weight: 120,
            reps: 8,
          },
          {
            weight: 130,
            reps: 6,
          },
          {
            weight: 110,
            reps: 10,
          },
          {
            weight: 90,
            reps: 10,
          },
          {
            weight: 60,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_front_squat',
        sets: [
          {
            weight: 20,
            reps: 10,
          },
          {
            weight: 45,
            reps: 10,
          },
          {
            weight: 50,
            reps: 10,
          },
          {
            weight: 40,
            reps: 10,
          },
        ],
      },
    ],
    '2026-08-28': [
      {
        exerciseId: 'ex_ab_roller',
        sets: [
          {
            weight: null,
            reps: 15,
          },
          {
            weight: null,
            reps: 20,
          },
          {
            weight: null,
            reps: 20,
          },
        ],
      },
      {
        exerciseId: 'ex_bench',
        sets: [
          {
            weight: 60,
            reps: 10,
          },
          {
            weight: 70,
            reps: 4,
          },
          {
            weight: 80,
            reps: 2,
          },
          {
            weight: 70,
            reps: 4,
          },
          {
            weight: 60,
            reps: 10,
          },
          {
            weight: 60,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_incline_bench',
        sets: [
          {
            weight: 40,
            reps: 7,
          },
          {
            weight: 36,
            reps: 10,
          },
          {
            weight: 36,
            reps: 9,
          },
          {
            weight: 32,
            reps: 10,
          },
          {
            weight: 32,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_db_fly',
        sets: [
          {
            weight: 16,
            reps: 10,
          },
          {
            weight: 16,
            reps: 9,
          },
          {
            weight: 14,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_pullup',
        sets: [
          {
            weight: null,
            reps: 10,
          },
          {
            weight: null,
            reps: 10,
          },
          {
            weight: null,
            reps: 7,
          },
          {
            weight: null,
            reps: 5,
          },
        ],
      },
      {
        exerciseId: 'ex_lateral_raise',
        sets: [
          {
            weight: 6,
            reps: 9,
          },
          {
            weight: 6,
            reps: 6,
          },
          {
            weight: 6,
            reps: 6,
          },
          {
            weight: 6,
            reps: 6,
          },
          {
            weight: 6,
            reps: 7,
          },
          {
            weight: 6,
            reps: 7,
          },
          {
            weight: 6,
            reps: 7,
          },
        ],
      },
      {
        exerciseId: 'ex_rear_raise',
        sets: [
          {
            weight: 6,
            reps: 6,
          },
          {
            weight: 6,
            reps: 6,
          },
          {
            weight: 6,
            reps: 6,
          },
        ],
      },
      {
        exerciseId: 'ex_curl_db',
        sets: [
          {
            weight: 12,
            reps: 10,
          },
          {
            weight: 12,
            reps: 7,
          },
          {
            weight: 10,
            reps: 8,
          },
          {
            weight: 10,
            reps: 8,
          },
          {
            weight: 10,
            reps: 8,
          },
        ],
      },
      {
        exerciseId: 'ex_reverse_curl_db',
        sets: [
          {
            weight: 9,
            reps: 9,
          },
          {
            weight: 8,
            reps: 9,
          },
          {
            weight: 8,
            reps: 10,
          },
          {
            weight: 8,
            reps: 10,
          },
        ],
      },
      {
        exerciseId: 'ex_hammer_curl',
        sets: [
          {
            weight: 8,
            reps: 10,
          },
          {
            weight: 8,
            reps: 8,
          },
          {
            weight: 8,
            reps: 10,
          },
        ],
      },
    ],
  },
  groupGoals: {
    chest: 20,
    back: 20,
    legs: 20,
    shoulders: 20,
    arms: 20,
    core: 20,
  },
  presets: [
    {
      id: '755f4262-cfba-477f-abb2-795430c73ed7',
      name: 'D1 (月)',
      exerciseIds: ['ex_squat', 'ex_rdl', 'ex_leg_curl', 'ex_calf_raise', 'ex_ab_roller'],
    },
    {
      id: 'a3ecacd4-3596-4abd-96be-bc790272baea',
      name: 'D2 (火)',
      exerciseIds: ['ex_bench', 'ex_lat_pulldown', 'ex_incline_bench', 'ex_db_fly'],
    },
    {
      id: 'b1cc2645-8e7f-498a-b344-85f22fbd5747',
      name: 'D3 (木)',
      exerciseIds: [
        'ex_deadlift',
        'ex_pullup',
        'ex_lateral_raise',
        'ex_rear_raise',
        'ex_wrist_curl',
        'ex_ab_roller',
      ],
    },
    {
      id: '6723c23c-247a-4176-a672-0c567e2c46b2',
      name: 'D4 (金)',
      exerciseIds: [
        'ex_incline_bench',
        'ex_db_fly',
        'ex_lateral_raise',
        'ex_rear_raise',
        'ex_pushdown',
      ],
    },
    {
      id: '37accd85-469a-4427-83a8-b17c1525ae0a',
      name: 'D5 (土)',
      exerciseIds: [
        'ex_ohp',
        'ex_lateral_raise',
        'ex_rear_raise',
        'ex_hammer_curl',
        'ex_reverse_wrist_curl',
        'ex_ab_roller',
      ],
    },
  ],
  checks: {
    enabled: true,
    sessionMinutes: 90,
    minutesPerSet: 3,
  },
};

/** 体組成だけを取り出す。既存の記録がある環境へ混ぜないための入口は storage.ts が持つ */
export function seedEntries(): AppData['entries'] {
  return (SEED_DATA as AppData).entries;
}
