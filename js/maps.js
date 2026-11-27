/* maps.js — mapas de batalla (solo cambia el aspecto; el campo es una franja de 120 m con la base de cada ejército en un extremo). */
export const MAPS = {
  valle:   { id: 'valle',   name: 'Valle del Alba',    length: 120, zHalf: 3.2, skyTop: '#5aa6e8', skyBot: '#e8f4ff', fog: 0xcfe6f7, ground: ['#4f8a38', '#6aa347', '#82b552'], road: '#a08c5e', mount: 0x6f8fae, tree: 0x2f7a3a, sun: 0xfff1d6, sunI: 2.1, trees: 70 },
  cenizas: { id: 'cenizas', name: 'Páramo de Ceniza',  length: 120, zHalf: 3.2, skyTop: '#3a2540', skyBot: '#f0a070', fog: 0xcf9a82, ground: ['#5a4a44', '#6e5a4e', '#7e695a'], road: '#8a7058', mount: 0x6a4a58, tree: 0x4a3a3a, sun: 0xffc08a, sunI: 1.9, trees: 40 },
  nieve:   { id: 'nieve',   name: 'Cumbre Helada',     length: 120, zHalf: 3.2, skyTop: '#6f92c4', skyBot: '#f4f8ff', fog: 0xe0ecf8, ground: ['#cfdce8', '#dde8f2', '#eef4fa'], road: '#a9b7c4', mount: 0xa8bcd4, tree: 0x2f5f4a, sun: 0xe8f0ff, sunI: 1.9, trees: 50 },
};
export const MAP_ORDER = ['valle', 'cenizas', 'nieve'];
export const ARMIES = [
  { id: 0, name: 'Legión del Alba',  color: 0x3d7be0, css: '#3d7be0', accent: 0xf0c850, perk: '+10 % de vida de la base' },
  { id: 1, name: 'Horda de Ceniza',  color: 0xd24a3a, css: '#d24a3a', accent: 0x2b2b2b, perk: '+8 % de daño de las tropas' },
];
