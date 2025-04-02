const mongoose=require('mongoose');
const Schema=mongoose.Schema;

const candidateSchema= new Schema({
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    whyq:{
        type:String,
        required:true
    },
    images:[{
        url:String,
        filename:String
    }
    ],
    votes:{
        type:Number,
        default:0
    },
});

module.exports=mongoose.model('Candidate',candidateSchema);
