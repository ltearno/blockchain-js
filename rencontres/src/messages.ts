/**
 * Messages exchanged between client and server
 */

export interface OfferDto {
    offerId: string
    offerMessage: string
}

export interface AnswerDto {
    offerId: string
    answerMessage: string
}

export interface ConfirmationDto {
    offerId: string
    status: boolean // true means accepted, false means error
    offerMessage: string
}

export interface DataMessageDto {
    offerId: string
    payload: any
}