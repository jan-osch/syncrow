declare namespace commander {
    interface IExportedCommand extends ICommand {
        host:string;
        port:number;
        directory:string;
        local:number;
        listen:boolean;
        bucket:string;
        init:boolean;
        strategy:string;
    }
}
