/// <reference path="../../typings/main.d.ts" />


import {loggerFor, debugFor} from "../utils/logger";

const debug = debugFor("syncrow:user_service");
const logger = loggerFor('UserService');


export class UserService {
    //TODO all
    constructor() {

    }

    public validateCredentials(login:string, passwordHash:string):boolean {
        return true;
    }

}

const instance = new UserService();

export function getUserService(){
    return instance;
}