class expresserror extends Error{
    constructor(message,code){
        super();
        this.message=message;
        this.code=code;
    }
}

module.exports=expresserror;