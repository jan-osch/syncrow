
const EventTypes = {
    pull: 'pull',
    offer: 'offer',
    pullResponse: 'pullResponse',
    transferStatus: 'transferStatus'
};

export interface Event {
    type:string
}

export interface Pull extends Event {
    type:EventTypes.pull
    fileName:string,
    id:string
    command:string,
    port?:number
    host?:string
}

export interface Offer extends Event {
    type:EventTypes.offer
    fileName:string,
    id:string
}

export interface PullResponse extends Event {
    type:EventTypes.pullResponse,
    fileName:string,
    command:string,
    host?:string
    port?:number
    id:string
}

export interface TransferStatus extends Event {
    type:EventTypes.transferStatus
    fileName:string,
    id:string
    success:boolean
    message?:string
}

//TODO add more events