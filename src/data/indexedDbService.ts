import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

// Platzhalter-Schema für spätere Object Stores, z.B.:
// interface NutriBalanceDB extends DBSchema {
//   recipes: {
//     key: string
//     value: Recipe
//   }
// }
type NutriBalanceDB = DBSchema

const DB_NAME = 'nutribalance'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<NutriBalanceDB>> | null = null

export function getDb(): Promise<IDBPDatabase<NutriBalanceDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NutriBalanceDB>(DB_NAME, DB_VERSION, {
      upgrade() {
        // Object Stores werden hier bei zukünftigen Features angelegt.
      },
    })
  }
  return dbPromise
}
