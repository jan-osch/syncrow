export const eventTypes = {
    pull: 'pull',
    offer: 'offer',
    pullResponse: 'pullResponse',
    transferStatus: 'transferStatus',
    readyForTransfer: 'readyForTransfer'
};

export interface Event {
    type:string
}

export interface Pull extends Event {
    fileName:string,
    id:string
}

export interface Offer extends Event {
    fileName:string,
    id:string
}

export interface PullResponse extends Event {
    fileName:string,
    command:string,
    host?:string
    port?:number
    id:string
}

export interface ListeningToUpload extends Event {
    fileName:string,
    host:string
    port:number
    id:string
}

export interface TransferStatus extends Event {
    fileName:string,
    id:string
    success:boolean
    message?:string
}

//TODO add more events