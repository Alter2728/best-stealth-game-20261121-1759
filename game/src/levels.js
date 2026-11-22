// The three levels of the heist, drawn as ASCII maps (32 x 18 tiles).
//   #  wall (blocks movement and sight)
//   C  crate (blocks movement and sight: hard cover)
//   P  plant (walkable; crouch inside to hide)
//   .  floor
//   S  where the Nightjar slips in
//   G  the gem: steal it, then the exit opens
//   L  loose loot, worth score if you dare
//   E  the exit door
// Guard patrols are waypoint loops in tile coordinates; consecutive waypoints share a row or
// a column along open floor, so a guard's walk never crosses a wall. Cameras sweep around a
// rest direction (radians, 0 = east, growing clockwise as y grows downward).

export const LEVELS = [
  {
    name: 'The Gallery',
    brief: 'Two guards, quiet halls. Lift the Moonstone and slip out the way you came.',
    par: 75,
    map: [
      '################################',
      '#S.....#...........#...........#',
      '#......#.....C.....#.....L.....#',
      '#..PP..#...........#...........#',
      '#..PP..##.#####.####...####....#',
      '#......#.......................#',
      '#......#..C.......C............#',
      '#......#.......................#',
      '###.####....####.......####....#',
      '#..........#....#.......#......#',
      '#..C.......#....#...G...#...L..#',
      '#..........#....#.......#......#',
      '#..........#####.#######.......#',
      '#..............................#',
      '#....PP..........C.........E...#',
      '#....PP........................#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { patrol: [[12, 5], [24, 5], [24, 7], [12, 7]] },
      { patrol: [[3, 13], [3, 16], [16, 16], [16, 13]] },
    ],
    cameras: [],
  },
  {
    name: 'The Vault Wing',
    brief: 'Cameras sweep the vault. Time your crossing, or hide and let them pass.',
    par: 110,
    map: [
      '################################',
      '#S....#........#.......#.......#',
      '#.....#..C.....#...L...#...C...#',
      '#..P..#........#.......#.......#',
      '#..P..###.######.#####.###.#####',
      '#..............................#',
      '#.....C......C........C........#',
      '#####.#####......#####.....#####',
      '#..............................#',
      '#..PP.....####......####....PP.#',
      '#..PP.....#..#......#..#....PP.#',
      '#.........#..#..G...#..#.......#',
      '#.........#..#......#..#...L...#',
      '#####.#####..######.###....#####',
      '#..............................#',
      '#....C.......C........C......E.#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { patrol: [[2, 5], [29, 5]] },
      { patrol: [[2, 8], [29, 8]] },
      { patrol: [[6, 14], [24, 14], [24, 16], [6, 16]] },
    ],
    cameras: [
      { at: [16, 1], dir: Math.PI / 2 },
      { at: [16, 15], dir: -Math.PI / 2 },
    ],
  },
  {
    name: 'The Rooftop Garden',
    brief: 'Four guards among the planters. The Star Sapphire sleeps in the glass house.',
    par: 140,
    map: [
      '################################',
      '#S.....PP......#.......PP......#',
      '#......PP..C...#..L....PP..C...#',
      '#..C...........#...............#',
      '####.######....###.#####...#####',
      '#..............................#',
      '#...PP......C......C......PP...#',
      '#...PP....................PP...#',
      '##.#####......####......#####.##',
      '#...........#......#...........#',
      '#..C........#..G...#........C..#',
      '#...........#......#...........#',
      '#....PP.....###.####.....PP....#',
      '#....PP..................PP....#',
      '#####....#####......#####....###',
      '#..............................#',
      '#..L.........C......C.......E..#',
      '################################',
    ],
    guards: [
      { patrol: [[2, 5], [29, 5]] },
      { patrol: [[2, 9], [9, 9], [9, 12], [2, 12]] },
      { patrol: [[22, 9], [29, 9], [29, 12], [22, 12]] },
      { patrol: [[4, 15], [27, 15]] },
    ],
    cameras: [
      { at: [16, 1], dir: Math.PI / 2 },
      { at: [8, 8], dir: Math.PI / 2 },
      { at: [23, 8], dir: Math.PI / 2 },
    ],
  },
];

/** Tile characters that block both movement and sight. */
export const SOLID = new Set(['#', 'C']);

/** Parse a level map into a grid plus the named spots (start, gem, exit, loot, plants). */
export function parseLevel(level) {
  const grid = [];
  const loot = [];
  const plants = [];
  let start = null;
  let gem = null;
  let exit = null;
  for (let row = 0; row < level.map.length; row += 1) {
    const line = level.map[row];
    const cells = [];
    for (let col = 0; col < line.length; col += 1) {
      const ch = line[col];
      cells.push(ch);
      if (ch === 'S') start = { col, row };
      else if (ch === 'G') gem = { col, row };
      else if (ch === 'E') exit = { col, row };
      else if (ch === 'L') loot.push({ col, row });
      else if (ch === 'P') plants.push({ col, row });
    }
    grid.push(cells);
  }
  return { grid, start, gem, exit, loot, plants };
}
