/**
 * Bewusst binär gehalten: Die D-A-CH-Referenzwerte (siehe
 * `features/nutrient-requirements`) sind nur nach männlich/weiblich
 * gestaffelt. Diese Vereinfachung ist im Bericht als methodische
 * Einschränkung zu erwähnen, nicht als Aussage über Geschlechtsidentität.
 */
export type Gender = 'male' | 'female'

export interface UserProfile {
  age: number
  gender: Gender
  heightCm: number
}
