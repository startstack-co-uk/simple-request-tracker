import * as sqlite3 from 'sqlite3';
import * as BirdPromise from 'bluebird';
import { _totalTracking, _totalPerMethod, _totalPerPath, _totalPerPathMethodCombo} from './enums/queries.enum';

let backupDb;
let backupDbTable;

export interface RequestSchema {
  path: string;
  method: string;
}

interface DbEntrySchema {
  path: string;
  method: string;
  count: number;
}


export function init( paths: any[]): void {
  const dbpath: string = "src/data.sqlite";
  backupDb = new sqlite3.Database(dbpath, (err) => {
    if (err) {
      throw err;
    } else {
      backupDb.run(`
        create table if not exists requests(
          id integer primary key autoincrement,
          path varchar(100) not null,
          method varchar(10) not null,
          count integer default 0
        )
      `,undefined, async(err) => {
        if(err){ throw err;}
        let query: string = "BEGIN TRANSACTION;"; 
        paths = await paths.map((data) => {
          const toInsert: string = `insert into requests(path, method, count)
            select "${data.path}","${data.methods[0]}", 0
            where not exists (select 1 from requests where path="${data.path}" and method="${data.methods[0]}");`;
          return toInsert;
        });
        query = query + paths.join("") + "COMMIT;";
        backupDb.exec(query, (err) => {if(err) throw err});
      });
    }
  })
}


async function insertToTable(entry: DbEntrySchema): Promise<void>{
  const result = await backupDb.run(`
    insert into requests (path, method, count) 
    values ("${entry.path}", "${entry.method}", "${entry.count}")`,undefined, (err) => {
      if(err){
        throw err;
      }
    })
}


async function updateTableEntry(entry: DbEntrySchema): Promise<void>{
  let result = await backupDb.run(`
  Update requests
  set count = ${entry.count} where path = "${entry.path}" and method = "${entry.method}"
  `, undefined, (err) => {
      if (err) {
        throw err;
      }
    })
}


export function track(entry: RequestSchema): void {
  const sql: string = `select * from requests where path="${entry.path}" and method="${entry.method}"`;
  backupDb.get(sql,undefined, (err, row) => {
    if(err){
      throw err;
    }
    if(!row){
      const newEntry: DbEntrySchema = { ...entry, count:0};
      insertToTable(newEntry);
    }else{
      row.count++;
      updateTableEntry(row);
    }
  })
}

// FOLLOWING ARE METHODS TO QUERY DATA

export async function getTotal(): Promise< {total: number}[]>{
  return new BirdPromise((resolve, reject) => {
    backupDb.all(_totalTracking, [], (err, rows) => {
      if(err){
        reject(err);
      }
      resolve(rows);
    });
  })
}


export async function getTotalPerMethod(): Promise<{method:string, total:number}[]>{
  return new BirdPromise((resolve, reject) => {
    backupDb.all(_totalPerMethod, [], (err, result) => {
      if(err){
        reject(err);
      }
      resolve(result);
    })
  })
}


export async function getTotalPerPath(): Promise<{path:string, total:number}[]>{
  return new BirdPromise((resolve, reject) => {
    backupDb.all(_totalPerPath, [], (err, result) => {
      if(err){
        reject(err);
      }
      resolve(result);
    })
  })
}


export async function getTotalPerCombo(path: string, method: string): Promise<{path: string, method: string, total: number}[]>{
  let splitQuery: string[] = _totalPerPathMethodCombo.split('?');
  let modifiedQuery: string = splitQuery[0] + path + splitQuery[1] + method + splitQuery[2];
  return new BirdPromise((resolve, reject) => {
    backupDb.all(modifiedQuery, [], (err, result) => {
      if(err){
        reject(err);
      }
      resolve(result);
    })
  })
}