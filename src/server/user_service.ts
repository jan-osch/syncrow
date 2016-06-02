/// <reference path="../../typings/main.d.ts" />

class UserService {
    constructor() {

    }

    validateCredentials(login:string, passwordHash:string):boolean {
        return true;
    }


}

export = new UserService();
