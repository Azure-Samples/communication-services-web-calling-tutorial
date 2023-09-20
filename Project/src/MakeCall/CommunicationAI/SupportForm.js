import React, { useState } from "react";
import {
    TextField, PrimaryButton, Checkbox
} from 'office-ui-fabric-react'

export const SupportForm = (props) => {
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [dateOfPurchse, setDateOfPurchase] = useState("");
    const [issueDescription, setIssueDescription] = useState("");
    const [productUnderWarranty, setProductUnderWarranty] = useState(false);
    const [issueTicket, setIssueTicket] = useState("");

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
                <div className="">
                    <TextField
                        placeholder="Address"
                        defaultValue={props.address}
                        onChange={(e) => { setAddress(e.target.value)}} 
                    />
                </div>
                <div className="ms-Grid-row">
                    <TextField
                        placeholder="PhoneNumber" 
                        defaultValue={props.phoneNumber}
                        onChange={(e) => { setPhoneNumber(e.target.value)}}  />
                </div>
                <div className="ms-Grid-row">
                    <TextField
                        placeholder="Date of Purchase" 
                        defaultValue={props.dateOfPurchase}
                        onChange={(e) => { setDateOfPurchase(e.target.value)}}  />
                </div>
                <div className="ms-Grid-row">
                    <TextField
                        placeholder="Issue Description" 
                        multiline rows={10}
                        defaultValue={props.issue}
                        onChange={(e) => { setIssueDescription(e.target.value)}}  />
                </div>
                <div className="ms-Grid-row">
                    <Checkbox label="Product under Warranty"  checked={props.productUnderWarranty} onChange={(e, checked) => {setProductUnderWarranty(checked)}} />
                </div>
                
                <div className="ms-Grid-row">
                    <TextField
                        placeholder="Issue Ticket" 
                        defaultValue={props.issueTicket}
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