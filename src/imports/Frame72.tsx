function Text() {
  return (
    <div className="flex-[83_0_0] h-[21px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <p className="absolute font-['Inter:Bold','Noto_Sans_Math:Regular',sans-serif] font-bold leading-[0] left-0 not-italic text-[#0a0a0a] text-[14px] top-0 tracking-[-0.1504px] whitespace-nowrap">
          <span className="leading-[21px]">Budget</span>
          <span className="leading-[21px] text-[#d1d5dc]">⇅</span>
        </p>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[21px] relative shrink-0 w-[83px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center relative size-full">
        <Text />
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-start min-h-px min-w-px relative" data-name="Container">
      <Container1 />
    </div>
  );
}

function Container2() {
  return <div className="bg-[#aeb3bc] h-[13px] shrink-0 w-[4px]" data-name="Container" />;
}

function Frame() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-full">
      <div className="content-stretch flex items-start pl-[7px] relative size-full">
        <Container />
        <Container2 />
      </div>
    </div>
  );
}

function TextInput() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Text Input">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-center px-[8px] relative size-full">
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[12px] text-[rgba(10,10,10,0.5)] whitespace-nowrap">Filter...</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[rgba(0,0,0,0.1)] border-solid border-t inset-0 pointer-events-none" />
    </div>
  );
}

function HeaderCell() {
  return (
    <div className="bg-white flex-[1_0_0] min-h-px min-w-px relative w-full" data-name="Header Cell">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start py-px relative size-full">
          <Frame />
          <TextInput />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#d1d5dc] border-l-2 border-r border-solid border-t inset-0 pointer-events-none" />
    </div>
  );
}

export default function Frame1() {
  return (
    <div className="content-stretch flex flex-col items-start relative size-full">
      <div aria-hidden="true" className="absolute border-[#9fa6bc] border-b border-solid inset-[0_0_-1px_0] pointer-events-none" />
      <HeaderCell />
    </div>
  );
}