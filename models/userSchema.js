const mongoose=require('mongoose');
const Schema=mongoose.Schema;
const passportlocalmongoose=require('passport-local-mongoose');
const Candidate=require('./candidateSchema');

const userSchema= new Schema({
    email:{
        type:String,
        required:true,
        unique:true
    },
    noOfVotes:{
        type:Number,
        deafult:0,
    },
    votedCandidates: [
        { type: mongoose.Schema.Types.ObjectId, 
        ref: 'Candidate' 
    }]
});

userSchema.plugin(passportlocalmongoose);
module.exports=mongoose.model('User',userSchema);