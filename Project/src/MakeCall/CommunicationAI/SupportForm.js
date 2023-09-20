import React, { useState } from "react";
import {
    TextField, PrimaryButton, Checkbox
} from 'office-ui-fabric-react'

export const SupportForm = (props) => {
    const [name, setName] = useState(props.name);
    const [phoneNumber, setPhoneNumber] = useState(props.phoneNumber);
    const [issueDescription, setIssueDescription] = useState(props.issueDescription);
    const [dateOfPurchse, setDateOfPurchase] = useState(props.phoneNumber);
    const [productUnderWarranty, setProductUnderWarranty] = useState(props.productUnderWarranty);
    const [issueTicket, setIssueTicket] = useState(props.issueTicket);

    return <>
        <div className="ms-Grid-col ms-Grid-col ms-sm6 ms-md6 ms-lg6" >
            <div className="ms-Grid-row">
                <div className="">
                    <TextField
                        placeholder="Username"
                        defaultValue={props.name}
                        onChange={(e) => { setName(e.target.value)}} 
                    />
                </div>
                <div className="ms-Grid-row">
                    <TextField
                        placeholder="PhoneNumber" 
                        value={props.phoneNumber}
                        onChange={(e) => { setPhoneNumber(e.target.value)}}  />
                </div>
                <div className="ms-Grid-row">
                    <TextField
                        placeholder="Date of Purchase" 
                        value={props.dateOfPurchase}
                        onChange={(e) => { setDateOfPurchase(e.target.value)}}  />
                </div>
                <div className="ms-Grid-row">
                    <TextField
                        placeholder="Issue Description" 
                        multiline rows={10}
                        value={props.issue}
                        onChange={(e) => { setIssueDescription(e.target.value)}}  />
                </div>
                <div className="ms-Grid-row">
                    <Checkbox label="Product under Warranty"  checked={props.productUnderWarranty} onChange={(e, checked) => {setProductUnderWarranty(checked)}} />
                </div>
                
                <div className="ms-Grid-row">
                    <TextField
                        placeholder="Issue Ticket" 
                        value={props.issueTicket}
                        onChange={(e) => { setIssueTicket(e.target.value)}}  />
                </div>
            </div>
            <div className="ms-Grid-row">
                <div className="ms-Grid-col">
                    <PrimaryButton className="primary-button mt-5"
                        onClick={() => {}}>
                            Submit Ticket
                    </PrimaryButton>
                </div>
            </div>
        </div>
    </>
}