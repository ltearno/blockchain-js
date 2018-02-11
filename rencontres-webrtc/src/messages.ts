/**
 * Messages exchanged between client and server
 */

export interface OfferDto {
    offerId: string
    offerMessage: string
    sdp: RTCSessionDescriptionInit
}

export interface AnswerDto {
    offerId: string
    sdp: RTCSessionDescriptionInit
}

export interface CandidateDto {
    offerId: string
    candidate: RTCIceCandidate
}