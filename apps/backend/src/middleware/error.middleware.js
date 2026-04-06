import logger from "../config/config.logger.js"
import { AppError } from "../utils/AppError.js"
import { ZodError } from "zod"


export const ErrHandle =(async (err,req,res,next)=>{
    // console.log(err)
    logger.error(err)


    if (err instanceof ZodError) {
        return res.status(400).json({
        message: "Validation failed",
        errors: err.issues.map(e => ({
            field: e.path.join("."),
            message: e.message
        }))
        });
    }

    if(err.isOperational){
        return res.status(err.statusCode).json({
            message:err.message
        })
    }
    return res.status(500).json({
        message:"Something went wrong"
    })

    // res.status(err.status || 500 ).json({
    //     message:"Error" || err.message
    // })
})