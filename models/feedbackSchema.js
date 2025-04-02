const mongoose=require('mongoose');
const Schema=mongoose.Schema;
const feedbackSchema= new Schema({
    body:{
        type:String,
        required: true
    },
    rating:{
        type:Number,
        required: true
    },
    author:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required: true
    }
});
    
module.exports=mongoose.model('Feedback',feedbackSchema);