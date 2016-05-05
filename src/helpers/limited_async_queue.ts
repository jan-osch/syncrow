/// <reference path="../../typings/main.d.ts" />


export class LimitedAsyncQueue {
    private limit:number;
    private current:number;
    private awaitingQueue:Array<(callback:()=>void)=>any>;

    constructor(limit:number) {
        this.limit = limit;
        this.current = 0;
        this.awaitingQueue = [];
    }

    public add(functionToAdd:(callback:()=>void)=>any) {
        if (this.isSpaceAvailable()) {
            this.execute(functionToAdd);
        } else {
            this.awaitingQueue.push(functionToAdd);
        }
    }

    private isSpaceAvailable() {
        return this.current < this.limit;
    }

    private execute(functionToExecute:(callback:()=>void)=>any) {
        this.current++;
        functionToExecute(()=>this.decreaseCurrentAndProcessNext);
    }

    private decreaseCurrentAndProcessNext() {
        this.current--;

        const nextToExecute = this.awaitingQueue.shift();
        if (nextToExecute)
            this.execute(nextToExecute);
    }

}


