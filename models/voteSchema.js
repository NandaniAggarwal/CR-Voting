const mongoose=require('mongoose');
const Schema=mongoose.Schema;

const voteSchema= new Schema({
    candidateid:{
        type:String,
        required:true
    },
});

module.exports=mongoose.model('Vote',voteSchema);
